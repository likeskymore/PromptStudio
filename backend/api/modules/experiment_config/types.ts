import { LLMResponseData } from "../LLM/types";

export type Promptconfig = {
  id: number;
  experiment_id: number;
  LLM_id: number;
  LLM_param_id: number;
  prompt_template_id: number;
  final_dataset_id: number;
  datasets: number[];
};

export type PromptVarsDict = {
  [key: string]: LLMResponseData;
};

export type MarkerValue = {
  id: number;
  marker_id: number;
  value: string;
};

export type Input = {
  id: number;
  markers: MarkerValue[];
};

export type ResolvedInput = {
  input_id: number;
  vars: PromptVarsDict;
};

export type Dataset = {
  node_id: number;
  name: string;
  path: string;
};
