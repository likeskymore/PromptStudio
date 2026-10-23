import { LLMSpec } from "../LLM/types";

export type PromptTemplate = {
  node_id: number;
  value: string;
  name: string;
  iterations: number;
  llms: LLMSpec[];
};