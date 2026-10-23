import MarkdownIt from "markdown-it";
import { LLM } from "./models";

export interface Dict<T = any> {
  [key: string]: T;
}

export type ResponseUID = string;


export type JSONLeaf = string | number | boolean | null | undefined;

export type JSONCompatible<T = JSONLeaf> =
  | T
  | JSONCompatible<T>[]
  | Dict<JSONCompatible<T>>;

export type QueryProgress = {
  success: number;
  error: number;
};

export type LLMResponseData = string;

/** Raised when there is an error generating a single response from an LLM */
export class LLMResponseError extends Error {
  private readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LLMResponseError";
    this.status = status;
  }
  getStatus(): number {
    return this.status;
  }
}

export interface OpenAIFunctionCall {
  name: string;
  parameters: Dict;
  description?: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  images?: string[]; // MediaLookup UIDs
  name?: string;
  function_call?: OpenAIFunctionCall;
}
export type ChatHistory = ChatMessage[];

export type EvaluationScore =
  | boolean
  | number
  | string
  | Dict<boolean | number | string>;

export type EvaluationResults = {
  items: EvaluationScore[];
  dtype:
    | "KeyValue"
    | "KeyValue_Numeric"
    | "KeyValue_Categorical"
    | "KeyValue_Mixed"
    | "Numeric"
    | "Categorical"
    | "Mixed"
    | "Unknown"
    | "Empty"
    | "Boolean";
};

/** What LLM to call, at what settings. */
export type LLMSpec = {
  name: string;
  emoji?: string;
  base_model: string;
  model: string;
  temp: number;
  key?: string;
  formData?: Dict<JSONCompatible>;
  settings?: Dict<JSONCompatible>;
  progress?: QueryProgress; // only used for front-end to display progress collecting responses for this LLM
};

export interface BaseLLMResponseObject {
  /** A unique ID to refer to this response */
  uid: ResponseUID;
  /** The concrete prompt that led to this response. */
  prompt: string;
  /** The variables fed into the prompt. */
  vars: Dict<LLMResponseData>;
  /** Any associated metavariables. */
  metavars: Dict<LLMResponseData>;
  /** The LLM to query (usually a dict of settings) */
  llm: LLMSpec;
  /** Optional: The chat history to pass the LLM */
  chat_history?: ChatHistory;
}

export interface LLMResponse extends BaseLLMResponseObject {
  // Extracted responses (1 or more) from raw_response
  responses: LLMResponseData[];
  // Evaluation results
  eval_res?: EvaluationResults;
  // Token lengths (if given)
  tokens?: Dict<number>;
}

/** A JSON object describing an LLM response for the same prompt, with n responses (n>=1) */
export interface RawLLMResponseObject extends BaseLLMResponseObject {
  // A snapshot of the exact query (payload) sent to the LLM's API
  // DEPRECATED: This is now deprecated since it wastes precious storage space.
  // query: Dict;
  // The raw JSON response from the LLM
  // NOTE: This is now deprecated since it wastes precious storage space.
  // raw_response: Dict;
  // Extracted responses (1 or more) from raw_response
  responses: LLMResponseData[];
  // Token lengths (if given)
  tokens?: Dict<number>;
}

export interface LLMPrompterResults {
  llm_key: string;
  responses: Array<RawLLMResponseObject>;
  errors: Array<LLMResponseError>;
}

export type Llm = {
  id: number;
  base_model: string;
  name: string;
  model: string;
};

export type Llm_params = {
  id: number;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  stop_sequence?: string;
  frequency_penalty?: number;
  presence_penalty?: number;
  custom_params?: Record<string, string>;
};

/** Stores info about a single LLM response. Passed to evaluator functions. */
export class ResponseInfo {
  text: string; // The text of the LLM response
  prompt: string; // The text of the prompt using to query the LLM
  var: Dict; // A dictionary of arguments that filled in the prompt template used to generate the final prompt
  meta: Dict; // A dictionary of metadata ('metavars') that is 'carried alongside' data used to generate the prompt
  llm: string | LLM; // The name of the LLM queried (the nickname in ChainForge)

  constructor(
    text: string,
    prompt: string,
    _var: Dict,
    meta: Dict,
    llm: string | LLM,
  ) {
    this.text = text;
    this.prompt = prompt;
    this.var = _var;
    this.meta = meta;
    this.llm = llm;
  }

  toString(): string {
    return this.text;
  }

  asMarkdownAST() {
    const md = new MarkdownIt();
    return md.parse(this.text, {});
  }
}