enum Return_type {
  string = "string",
  number = "number",
  boolean = "boolean",
}
export enum Eval_type {
  simple,
  javascript,
  python,
  llm,
  multieval,
}

export type Evaluator = {
  node_id: number;
  type: Eval_type;
  file?: string;
  code?: string;
  name: string;
  return_type: Return_type;
};

export type SimpleEvaluator = {
  node_id: number;
  name: string;
  return_type: Return_type;
  text_value: string;
  var_value: string;
  var_type: string;
  var_selected: boolean;
};

export type LlmEvaluator = {
  node_id: number;
  name: string;
  llm_param_id: number;
  llm_id: number;
  format: string;
  prompt: string;
  reason_before_scoring: boolean;
};

export type MultiEvaluator = {
  node_id: number;
  name: string;
};

export type MultiEvaluatorMapping = [number, number];

