export enum NodeType {
  "prompt_template" = "prompt_template",
  "processor" = "processor",
  "evaluator" = "evaluator",
  "dataset" = "dataset",
}

export type Experiment_node = {
  id: number;
  type: NodeType;
  experiment_id: number;
  name: string;
};

export type Link = {
  source_node_id: number;
  target_node_id: number;
  source_var: string | null;
  target_var: string | null;
};