export enum Processor_type {
  join,
  split,
  javascript,
  python,
}

export type ExperimentProcessor = {
  node_id: number;
  type: Processor_type;
  code?: string;
  format?: string;
  selected_group_vars?: string;
  name: string;
};

export type ProcessorResult = {
  processor_result: string;
  result_id?: number;
  processor_id: number;
  input_id?: number;
};
