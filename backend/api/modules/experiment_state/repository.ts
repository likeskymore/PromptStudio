import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Prisma } from "../../../../generated/prisma/browser";
import {
  ExperimentRunMetadata,
  ExperimentRunSample,
  ExperimentRunState,
} from "./types";
import { toBigIntMilliseconds } from "./helpers";



function mapRunState(row: any): ExperimentRunState {
  return {
    experiment_id: row.experimentId,
    run_id: row.runId,
    experiment_name: row.experimentName,
    status: row.status,
    created_at: row.createdAt.toISOString(),
    started_at: row.startedAt?.toISOString(),
    paused_at: row.pausedAt?.toISOString(),
    finished_at: row.finishedAt?.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    total_paused_ms: Number(row.totalPausedMs ?? 0),
    total_tasks: row.totalTasks,
    attempts: row.attempts,
    in_progress: row.inProgress,
    completed: row.completed,
    failed: row.failed,
    retries: row.retries,
    total_tokens: Number(row.totalTokens ?? 0),
    last_error: row.lastError ?? undefined,
    total_latency_ms: Number(row.totalLatencyMs ?? 0),
    latency_count: row.latencyCount,
    min_latency_ms: Number(row.minLatencyMs ?? 0),
    p25_latency_ms: Number(row.p25LatencyMs ?? 0),
    p50_latency_ms: Number(row.p50LatencyMs ?? 0),
    p75_latency_ms: Number(row.p75LatencyMs ?? 0),
    p95_latency_ms: Number(row.p95LatencyMs ?? 0),
    p99_latency_ms: Number(row.p99LatencyMs ?? 0),
    max_latency_ms: Number(row.maxLatencyMs ?? 0),
    latency_samples: [],
    samples: Array.isArray(row.samples)
      ? (row.samples as unknown as ExperimentRunSample[])
      : [],
  };
}

export const ExperimentStateRepository = {
  async get_experiment_runs_metadata(
    connection: DatabaseClient = prisma,
  ): Promise<ExperimentRunMetadata[]> {
    try {
      const rows = await getClient(connection).experimentRun.findMany({
        select: {
          runId: true,
          experimentName: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          updatedAt: true,
        },
      });
      return rows.map((row) => ({
        run_id: row.runId,
        experiment_name: row.experimentName,
        status: row.status,
        started_at: row.startedAt?.toISOString(),
        finished_at: row.finishedAt?.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      })) as ExperimentRunMetadata[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  async get_experiment_run_state_by_run_id(
    runId: string,
    connection: DatabaseClient = prisma,
  ): Promise<ExperimentRunState | undefined> {
    try {
      const row = await getClient(connection).experimentRun.findUnique({
        where: { runId },
      });
      return row ? mapRunState(row) : undefined;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  },
  /**
   * Retrieves an experiment by its name.
   * @param experiment_name The name of the experiment to retrieve.
   * @param connection
   * @returns The Experiment object if found, otherwise undefined.
   */
  async get_experiment_run_state_by_experiment_name(
    experiment_name: string,
    connection: DatabaseClient = prisma,
  ): Promise<ExperimentRunState | undefined> {
    try {
      const row = await getClient(connection).experimentRun.findFirst({
        where: { experimentName: experiment_name },
      });
      return row ? mapRunState(row) : undefined;
    } catch (error) {
      console.error(error);
    }
  },
  async upsert_experiment_run_snapshot(
    runState: ExperimentRunState,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const data = {
        runId: runState.run_id,
        experimentId: runState.experiment_id,
        experimentName: runState.experiment_name,
        status: runState.status as any,
        createdAt: new Date(runState.created_at),
        startedAt: runState.started_at ? new Date(runState.started_at) : null,
        pausedAt: runState.paused_at ? new Date(runState.paused_at) : null,
        finishedAt: runState.finished_at
          ? new Date(runState.finished_at)
          : null,
        totalPausedMs: toBigIntMilliseconds(runState.total_paused_ms ?? 0),
        totalTasks: runState.total_tasks,
        attempts: runState.attempts,
        inProgress: runState.in_progress,
        completed: runState.completed,
        failed: runState.failed,
        retries: runState.retries,
        totalTokens: BigInt(Math.round(runState.total_tokens)),
        lastError: runState.last_error ?? null,
        totalLatencyMs: toBigIntMilliseconds(runState.total_latency_ms),
        latencyCount: runState.latency_count,
        minLatencyMs: toBigIntMilliseconds(runState.min_latency_ms),
        p25LatencyMs: toBigIntMilliseconds(runState.p25_latency_ms),
        p50LatencyMs: toBigIntMilliseconds(runState.p50_latency_ms),
        p75LatencyMs: toBigIntMilliseconds(runState.p75_latency_ms),
        p95LatencyMs: toBigIntMilliseconds(runState.p95_latency_ms),
        p99LatencyMs: toBigIntMilliseconds(runState.p99_latency_ms),
        maxLatencyMs: toBigIntMilliseconds(runState.max_latency_ms),
        samples: runState.samples as Prisma.InputJsonValue,
      };
      await getClient(connection).experimentRun.upsert({
        where: { runId: runState.run_id },
        create: data,
        update: { ...data, createdAt: undefined },
      });
    } catch (error) {
      console.error("Error saving experiment run snapshot:", error);
    }
  },
};
