import { randomUUID } from "crypto";
import { upsert_experiment_run_snapshot } from "../database/database";
import { ExperimentRunState } from "./types";

type Listener = (state: ExperimentRunState) => void;

const experimentRuns = new Map<string, ExperimentRunState>();
const listeners = new Map<string, Set<Listener>>();
const snapshotTimers = new Map<string, NodeJS.Timeout>();

function now() {
  return new Date().toISOString().replace("T", " ").replace("Z", " ");
}

function cloneState(state: ExperimentRunState): ExperimentRunState {
  return {
    ...state,
    samples: state.samples.map((sample) => ({ ...sample })),
  };
}

function getListeners(runId: string) {
  let runListeners = listeners.get(runId);
  if (!runListeners) {
    runListeners = new Set();
    listeners.set(runId, runListeners);
  }
  return runListeners;
}

function notify(runId: string) {
  const state = experimentRuns.get(runId);
  if (!state) {
    return;
  }

  const snapshot = cloneState(state);
  for (const listener of getListeners(runId)) {
    listener(snapshot);
  }
}

function persistSnapshot(runId: string) {
  const state = experimentRuns.get(runId);
  if (!state) {
    return;
  }

  void upsert_experiment_run_snapshot(state).catch((error) => {
    console.error(`Error saving experiment run snapshot for ${runId}:`, error);
  });
}

function pushTimelineSample(state: ExperimentRunState) {
  state.samples.push({
    at: now(),
    totalTasks: state.totalTasks,
    attempts: state.attempts,
    completed: state.completed,
    failed: state.failed,
    retries: state.retries,
    totalTokens: state.totalTokens,
  });

  if (state.samples.length > 120) {
    state.samples.shift();
  }
}

function scheduleSnapshotTimer(runId: string) {
  if (snapshotTimers.has(runId)) {
    return;
  }

  const timer = setInterval(() => {
    const state = experimentRuns.get(runId);
    if (!state) {
      stopSnapshotTimer(runId);
      return;
    }

    pushTimelineSample(state);
    state.updatedAt = now();
    persistSnapshot(runId);
    notify(runId);
  }, 5000);

  timer.unref?.();
  snapshotTimers.set(runId, timer);
}

function stopSnapshotTimer(runId: string) {
  const timer = snapshotTimers.get(runId);
  if (timer) {
    clearInterval(timer);
    snapshotTimers.delete(runId);
  }
}

function mutateRunState(runId: string, mutator: (state: ExperimentRunState) => void) {
  const state = experimentRuns.get(runId);
  if (!state) {
    return;
  }

  mutator(state);
  state.updatedAt = now();
  notify(runId);
}

export function createExperimentRun(experimentName: string) {
  const runId = randomUUID();
  const state: ExperimentRunState = {
    runId,
    experimentName,
    status: "queued",
    createdAt: now(),
    updatedAt: now(),
    totalTasks: 0,
    attempts: 0,
    completed: 0,
    failed: 0,
    retries: 0,
    totalTokens: 0,
    samples: [],
  };

  experimentRuns.set(runId, state);
  getListeners(runId);
  persistSnapshot(runId);
  notify(runId);

  return cloneState(state);
}

export function getExperimentRun(runId: string) {
  const state = experimentRuns.get(runId);
  return state ? cloneState(state) : undefined;
}

export function subscribeExperimentRun(runId: string, listener: Listener) {
  const runListeners = getListeners(runId);
  runListeners.add(listener);

  const state = experimentRuns.get(runId);
  if (state) {
    listener(cloneState(state));
  }

  return () => {
    runListeners.delete(listener);
  };
}

export function startExperimentRun(runId: string) {
  mutateRunState(runId, (state) => {
    state.status = "running";
    state.startedAt = state.startedAt ?? now();
  });

  scheduleSnapshotTimer(runId);
}

export function recordTaskQueued(runId: string) {
  mutateRunState(runId, (state) => {
    state.totalTasks += 1;
  });
}

export function recordTaskStarted(runId: string) {
  mutateRunState(runId, (state) => {
    state.attempts += 1;
  });
}

export function recordTaskRetry(runId: string, errorMessage?: string) {
  mutateRunState(runId, (state) => {
    state.retries += 1;
    if (errorMessage) {
      state.lastError = errorMessage;
    }
  });
}

export function recordTaskCompleted(runId: string, totalTokens = 0) {
  mutateRunState(runId, (state) => {
    state.completed += 1;
    state.totalTokens += totalTokens;
  });
}

export function recordTaskFailed(runId: string, errorMessage?: string) {
  mutateRunState(runId, (state) => {
    state.failed += 1;
    if (errorMessage) {
      state.lastError = errorMessage;
    }
  });
}

export function completeExperimentRun(runId: string) {
  mutateRunState(runId, (state) => {
    state.status = "completed";
    state.finishedAt = now();
    pushTimelineSample(state);
  });

  stopSnapshotTimer(runId);
  persistSnapshot(runId);
}

export function failExperimentRun(runId: string, errorMessage: string) {
  mutateRunState(runId, (state) => {
    state.status = "failed";
    state.finishedAt = now();
    state.lastError = errorMessage;
    pushTimelineSample(state);
  });

  stopSnapshotTimer(runId);
  persistSnapshot(runId);
}