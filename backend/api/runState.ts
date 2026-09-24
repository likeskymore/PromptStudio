import { randomUUID } from "crypto";
import { upsert_experiment_run_snapshot } from "../database/database";
import { ExperimentRunState } from "./types";

type Listener = (state: ExperimentRunState) => void;

const experimentRuns = new Map<string, ExperimentRunState>();
const listeners = new Map<string, Set<Listener>>();
const snapshotTimers = new Map<string, NodeJS.Timeout>();
const pauseRequests = new Set<string>();
const MAX_LATENCY_SAMPLES = 10000;

function now() {
  return new Date().toISOString();
}

function normalizeTimestamp(value: string | Date | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
          /(?:Z|[+-]\d{2}:?\d{2})$/.test(value.trim())
            ? value
            : `${value.trim().replace(" ", "T")}Z`,
        );
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function elapsedSince(timestamp: string) {
  const timestampMs = Date.parse(timestamp);
  return Number.isFinite(timestampMs)
    ? Math.max(0, Date.now() - timestampMs)
    : 0;
}

function percentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);

  const index = (percentile / 100) * (sorted.length - 1);

  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;

  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

function cloneState(state: ExperimentRunState): ExperimentRunState {
  return {
    ...state,
    samples: Array.isArray(state.samples)
      ? state.samples.map((sample) => ({ ...sample }))
      : [],
    latency_samples: Array.isArray(state.latency_samples)
      ? [...state.latency_samples]
      : [],
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
    return Promise.resolve();
  }

  return upsert_experiment_run_snapshot(state);
}

function pushTimelineSample(state: ExperimentRunState) {
  state.samples.push({
    at: now(),
    total_tasks: state.total_tasks,
    attempts: state.attempts,
    in_progress: state.in_progress,
    completed: state.completed,
    failed: state.failed,
    retries: state.retries,
    total_tokens: state.total_tokens,
    total_latency_ms: state.total_latency_ms,
    latency_count: state.latency_count,
    p50_latency_ms: state.p50_latency_ms,
    p95_latency_ms: state.p95_latency_ms,
    p99_latency_ms: state.p99_latency_ms,
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

    updateLatencyPercentiles(state);
    pushTimelineSample(state);
    state.updated_at = now();
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

function mutateRunState(
  runId: string,
  mutator: (state: ExperimentRunState) => void,
) {
  const state = experimentRuns.get(runId);
  if (!state) {
    return;
  }

  mutator(state);
  state.updated_at = now();
  notify(runId);
}

export function addExperimentRunState(runState: ExperimentRunState) {
  const persistedState = runState as ExperimentRunState & { samples?: unknown };
  const restoredState = {
    ...runState,
    created_at: normalizeTimestamp(runState.created_at) ?? now(),
    started_at: normalizeTimestamp(runState.started_at),
    paused_at: normalizeTimestamp(runState.paused_at),
    finished_at: normalizeTimestamp(runState.finished_at),
    updated_at: normalizeTimestamp(runState.updated_at) ?? now(),
    samples: Array.isArray(persistedState.samples)
      ? persistedState.samples.map((sample) => ({
          ...sample,
          at: normalizeTimestamp(sample.at) ?? sample.at,
        }))
      : typeof persistedState.samples === "string"
        ? JSON.parse(persistedState.samples)
        : [],
    latency_samples: Array.isArray(runState.latency_samples)
      ? runState.latency_samples
      : [],
    total_paused_ms: runState.total_paused_ms ?? 0,
  } as ExperimentRunState;

  experimentRuns.set(restoredState.run_id, restoredState);
  getListeners(restoredState.run_id);
  if (restoredState.status === "running") {
    scheduleSnapshotTimer(restoredState.run_id);
  }
  notify(restoredState.run_id);
}

export function createExperimentRun(experiment_id: number, experiment_name: string) {
  const runId = randomUUID();
  const state: ExperimentRunState = {
    experiment_id: experiment_id,
    run_id: runId,
    experiment_name,
    status: "queued",
    created_at: now(),
    updated_at: now(),
    total_tasks: 0,
    attempts: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
    retries: 0,
    total_tokens: 0,
    samples: [],
    total_latency_ms: 0,
    latency_count: 0,
    total_paused_ms: 0,
    p50_latency_ms: 0,
    p95_latency_ms: 0,
    p99_latency_ms: 0,
    latency_samples: [],
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
  pauseRequests.delete(runId);
  mutateRunState(runId, (state) => {
    if (state.status === "paused" && state.paused_at) {
      state.total_paused_ms =
        (state.total_paused_ms ?? 0) + elapsedSince(state.paused_at);
      state.paused_at = undefined;
    }
    state.status = "running";
    state.started_at = state.started_at ?? now();
    state.finished_at = undefined;
  });

  scheduleSnapshotTimer(runId);
}

export async function pauseExperimentRun(runId: string) {
  if (!experimentRuns.has(runId)) {
    throw new Error(`Run ${runId} not found`);
  }

  pauseRequests.add(runId);

  mutateRunState(runId, (state) => {
    if (state.status === "running" || state.status === "queued") {
      state.status = "paused";
      state.paused_at = now();
      pushTimelineSample(state);
    }
  });

  stopSnapshotTimer(runId);

  await persistSnapshot(runId);
}

export async function pauseRunningExperimentRuns() {
  for (const [runId, state] of experimentRuns.entries()) {
    if (state.status !== "running") {
      continue;
    }

    await pauseExperimentRun(runId);
  }
}

export function recordTotalTasks(runId: string, count: number) {
  mutateRunState(runId, (state) => {
    if (state.total_tasks === 0) {
      state.total_tasks = count;
    }
  });
}

export function recordTaskStarted(runId: string) {
  mutateRunState(runId, (state) => {
    state.attempts += 1;
    state.in_progress += 1;
  });
}

export function recordTaskRetry(runId: string, errorMessage?: string) {
  mutateRunState(runId, (state) => {
    state.in_progress = Math.max(0, state.in_progress - 1);
    state.retries += 1;
    if (errorMessage) {
      state.last_error = errorMessage;
    }
  });
}

export function recordTaskCompleted(runId: string, totalTokens = 0) {
  mutateRunState(runId, (state) => {
    state.in_progress = Math.max(0, state.in_progress - 1);
    state.completed += 1;
    state.total_tokens += totalTokens;
  });
}

export function recordTaskFailed(runId: string, errorMessage?: string) {
  mutateRunState(runId, (state) => {
    state.in_progress = Math.max(0, state.in_progress - 1);
    state.failed += 1;
    if (errorMessage) {
      state.last_error = errorMessage;
    }
  });
}

export function completeExperimentRun(runId: string) {
  mutateRunState(runId, (state) => {
    if (pauseRequests.has(runId)) {
      state.status = "paused";
      pushTimelineSample(state);
      return;
    }
    state.status = "completed";
    state.finished_at = now();
    pushTimelineSample(state);
  });

  stopSnapshotTimer(runId);
  persistSnapshot(runId);
}

export function failExperimentRun(runId: string, errorMessage: string) {
  mutateRunState(runId, (state) => {
    state.status = "failed";
    state.finished_at = now();
    state.last_error = errorMessage;
    pushTimelineSample(state);
  });

  stopSnapshotTimer(runId);
  persistSnapshot(runId);
}

export function isExperimentRunPauseRequested(runId: string) {
  return pauseRequests.has(runId);
}

export function recordRequestLatency(runId: string, latencyMs: number) {
  mutateRunState(runId, (state) => {
    state.total_latency_ms += latencyMs;
    state.latency_count += 1;

    state.latency_samples.push(latencyMs);

    if (state.latency_samples.length > MAX_LATENCY_SAMPLES) {
      state.latency_samples.shift();
    }
  });
}

function updateLatencyPercentiles(state: ExperimentRunState) {
  state.p50_latency_ms = percentile(state.latency_samples, 50);
  state.p95_latency_ms = percentile(state.latency_samples, 95);
  state.p99_latency_ms = percentile(state.latency_samples, 99);
}
