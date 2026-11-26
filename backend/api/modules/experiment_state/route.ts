import express from "express";
import { ResponseCode, sendResponse } from "../../common/responseHandler";
import { ExperimentStateService } from "./service";
import { ExperimentStateRepository } from "./repository";

const router = express.Router();

const SSE_THROTTLE_MS = 1000;

/** Streams throttled run snapshots and heartbeats until the client disconnects. */
router.get("/state/:runId/events", (req, res) => {
  const { runId } = req.params;
  const snapshot = ExperimentStateService.get_experiment_run(runId);

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

  let lastSent = Date.now();
  let pendingState: typeof snapshot | null = null;
  let throttleTimer: NodeJS.Timeout | undefined;

  const sendThrottledSnapshot = (state: typeof snapshot) => {
    const now = Date.now();
    const elapsed = now - lastSent;

    if (elapsed >= SSE_THROTTLE_MS) {
      lastSent = now;
      writeEvent("snapshot", state);
      return;
    }

    pendingState = state;

    if (throttleTimer) {
      return;
    }

    throttleTimer = setTimeout(() => {
      throttleTimer = undefined;

      if (pendingState) {
        lastSent = Date.now();
        writeEvent("snapshot", pendingState);
        pendingState = null;
      }
    }, SSE_THROTTLE_MS - elapsed);
  };

  const unsubscribe = ExperimentStateService.subscribe_experiment_run(
    runId,
    (state) => {
      sendThrottledSnapshot(state);
    },
  );

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\n`);
    res.write(`data: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);

    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = undefined;
    }

    unsubscribe();
    res.end();
  });
});

router.get("/", async (req, res) => {
  /** Returns lightweight metadata for persisted experiment runs. */
  try {
    const experiment_states_metadata =
      await ExperimentStateRepository.get_experiment_runs_metadata();

    return sendResponse(res, {
      body: {
        experiment_states_metadata,
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

router.get("/state/:runId", async (req, res) => {
  /** Returns one persisted run snapshot, or HTTP 404 when it is unavailable. */
  const { runId } = req.params;
  const snapshot =
    await ExperimentStateRepository.get_experiment_run_state_by_run_id(runId);

  if (!snapshot) {
    return res.status(404).json({ error: `Run ${runId} not found` });
  }

  return sendResponse(res, {
    body: snapshot,
  });
});

export const ExperimentStateRoutes = router;
