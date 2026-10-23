export type EvalOrProcessResult = {
  result_id?: number;
  input_id?: number;
  result?: any;
  error?: any;
};

export type EvalOrProcessResponse = {
  response?: EvalOrProcessResult;
  logs?: string[];
  error?: string;
};

export enum JoinFormat {
  DubNewLine = "\n\n",
  NewLine = "\n",
  DashedList = "-",
  NumList = "1.",
  PyArr = "[]",
}
