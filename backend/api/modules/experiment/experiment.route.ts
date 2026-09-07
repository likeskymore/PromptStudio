import express from "express";
import * as fs from "fs";
import { run_experiment } from "../../runner";
import {
  credentialsPath,
  get_all_experiments,
  get_llm_models_of_experiment_by_experiment_name,
} from "../../../database/database";
import { ResponseCode, sendResponse } from "../../common/responseHandler";

const router = express.Router();

const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
const api_keys = JSON.stringify(credentials.api_keys ?? {});



router.get("/run/:name", async (req, res) => {
  try {
    const experiment_name = req.params.name;
    const runId = await run_experiment(experiment_name, api_keys, {
      background: true,
    });
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

router.get("/", async (req, res) => {
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

router.get("/:experiment_name/models", async (req, res) => {
  try {
    const experiment_name = req.params.experiment_name;
    const models = await get_llm_models_of_experiment_by_experiment_name(experiment_name);

    return sendResponse(res, {
      body: {
        models,
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

export const ExperimentRoutes = router;
