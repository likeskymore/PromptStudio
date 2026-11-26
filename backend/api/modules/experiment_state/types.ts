export type Listener = (state: ExperimentRunState) => void;

export type ExperimentRunStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type ExperimentRunSample = {
  at: string;
  total_tasks: number;
  attempts: number;
  in_progress: number;
  completed: number;
  failed: number;
  retries: number;
  total_tokens: number;
  total_latency_ms: number;
  latency_count: number;
  min_latency_ms: number;
  p25_latency_ms: number;
  p50_latency_ms: number;
  p75_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  max_latency_ms: number;
};

export type ExperimentRunState = {
  experiment_id: number;
  run_id: string;
  experiment_name: string;
  status: ExperimentRunStatus;
  created_at: string;
  started_at?: string;
  paused_at?: string;
  finished_at?: string;
  updated_at: string;
  total_paused_ms?: number;
  total_tasks: number;
  attempts: number;
  in_progress: number;
  completed: number;
  failed: number;
  retries: number;
  total_tokens: number;
  last_error?: string;
  total_latency_ms: number;
  latency_count: number;
  min_latency_ms: number;
  p25_latency_ms: number;
  p50_latency_ms: number;
  p75_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  max_latency_ms: number;
  latency_samples: number[];
  samples: ExperimentRunSample[];
};

export interface ExperimentRunMetadata {
  run_id: string;
  experiment_name: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
}
