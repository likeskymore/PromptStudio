export type Result = {
  id: number;
  run_id?: string;
  config_id: number;
  output_result: string;
  input_id: number;
  start_time: Date;
  end_time: Date;
};
