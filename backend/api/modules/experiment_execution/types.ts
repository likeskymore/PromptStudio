import { PromptVarsDict, ResolvedInput } from "../experiment_config/types";
import { LLMSpec } from "../LLM/types";

export type EvaluationTask = {
  evaluator_id: number;
  llm_spec: LLMSpec | null;
  markersDict: PromptVarsDict | null;
  template_value: string | null;
  result: TaskResult;
  input_id: number | null;
  resolved_input_id?: number | null;
  resolved_inputs?: ResolvedInput[] | null;
};

export type TaskResult = {
  id?: number;
  run_id?: string;
  config_id?: number;
  output_result: string | null;
  input_id?: number;
  start_time?: Date;
  end_time?: Date;
};

export type Task = {
  config_id: number;
  llm_spec: LLMSpec;
  iterations: number;
  template_value: string;
  markersDict: PromptVarsDict;
  max_retry: number;
  input_id: number;
  tries: number;
};

export type WorkerTaskResult = {
  success: boolean;
  tries: number;
  totalTokens?: number;
  latencyMs?: number;
  responseCount?: number;
  errorCount?: number;
};
