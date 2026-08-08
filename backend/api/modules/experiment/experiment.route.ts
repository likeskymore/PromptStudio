import express from "express";
import * as fs from "fs";
import { run_experiment } from "../../runner";
import { credentialsPath, get_all_experiments, get_all_running_experiments } from "../../../database/database";
import { ResponseCode, sendResponse } from "../../common/responseHandler";
import { getExperimentRun, subscribeExperimentRun } from "../../runState";

const router = express.Router();

const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
const api_keys = JSON.stringify(credentials.api_keys ?? {});

router.get("/:runId/events", (req, res) => {
  const { runId } = req.params;
  const snapshot = getExperimentRun(runId);

  if (!snapshot) {
    return res.status(404).json({ error: `Run ${runId} not found` });
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const writeEvent = (event: string, payload: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  writeEvent("snapshot", snapshot);

  const unsubscribe = subscribeExperimentRun(runId, (state) => {
    writeEvent("snapshot", state);
  });

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\n`);
    res.write(`data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

router.get("/run/:name", async (req, res) => {
  try {
    const experiment_name = req.params.name;
    const runId = await run_experiment(experiment_name, api_keys, { background: true });
    return sendResponse(res, {
      body: {
        message: `Experiment ${experiment_name} started successfully.`,
        runId,
        eventsUrl: `/run_experiment/${runId}/events`,
      },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {

      
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.get("", async (req, res) => {
  try {
    const experiments = await get_all_experiments();

    return sendResponse(res, {
      body: {
        experiments,
      },
    });

  } catch (error) {
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.get("/running-experiments", async (req, res) => {
  try {
    const running_experiments = await get_all_running_experiments();

    return sendResponse(res, {
      body: {
        running_experiments,
      },
    });
  } catch (error) {
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

export const ExperimentRoutes = router;
    