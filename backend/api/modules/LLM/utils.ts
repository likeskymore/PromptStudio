/* eslint-disable @typescript-eslint/no-unused-vars */
import { LLMProvider } from "./models";
import { Dict, LLMResponse, LLMSpec, RawLLMResponseObject } from "./types";
import { v4 as uuid } from "uuid";

function get_environ(key: string): string | undefined {
  return process.env[key];
}

let OPENAI_API_KEY = get_environ("OPENAI_API_KEY");
let OPENAI_BASE_URL = get_environ("OPENAI_BASE_URL");
let ANTHROPIC_API_KEY = get_environ("ANTHROPIC_API_KEY");
let GOOGLE_PALM_API_KEY = get_environ("PALM_API_KEY");
let AZURE_OPENAI_KEY = get_environ("AZURE_OPENAI_KEY");
let AZURE_OPENAI_ENDPOINT = get_environ("AZURE_OPENAI_ENDPOINT");
let HUGGINGFACE_API_KEY = get_environ("HUGGINGFACE_API_KEY");
let ALEPH_ALPHA_API_KEY = get_environ("ALEPH_ALPHA_API_KEY");
let ALEPH_ALPHA_BASE_URL = get_environ("ALEPH_ALPHA_BASE_URL");
let AWS_ACCESS_KEY_ID = get_environ("AWS_ACCESS_KEY_ID");
let AWS_SECRET_ACCESS_KEY = get_environ("AWS_SECRET_ACCESS_KEY");
let AWS_SESSION_TOKEN = get_environ("AWS_SESSION_TOKEN");
let AWS_REGION = get_environ("AWS_REGION");
let TOGETHER_API_KEY = get_environ("TOGETHER_API_KEY");
let DEEPSEEK_API_KEY = get_environ("DEEPSEEK_API_KEY");

// A lookup that converts the base_model names into LLMProviders.
// Used for backwards compatibility.
// TODO in future: Deprecate base_model and migrate fully to using LLMProvider type throughout.
function baseModelToProvider(base_model: string): LLMProvider {
  const lookup: Record<string, LLMProvider> = {
    "gpt-3.5-turbo": LLMProvider.OpenAI,
    "gpt-4": LLMProvider.OpenAI,
    "dall-e": LLMProvider.OpenAI,
    "gpt-image-1": LLMProvider.OpenAI,
    "claude-v1": LLMProvider.Anthropic,
    "palm2-bison": LLMProvider.Google,
    "gemini-2.0-flash": LLMProvider.Google,
    "gemini-1.5-pro": LLMProvider.Google,
    "azure-openai": LLMProvider.Azure_OpenAI,
    hf: LLMProvider.HuggingFace,
    "luminous-base": LLMProvider.Aleph_Alpha,
    ollama: LLMProvider.Ollama,
    "br.anthropic.claude": LLMProvider.Bedrock,
    "br.ai21.j2": LLMProvider.Bedrock,
    "br.amazon.titan": LLMProvider.Bedrock,
    "br.cohere.command": LLMProvider.Bedrock,
    "br.mistral.mistral": LLMProvider.Bedrock,
    "br.mistral.mixtral": LLMProvider.Bedrock,
    "br.meta.llama2": LLMProvider.Bedrock,
    "br.meta.llama3": LLMProvider.Bedrock,
    together: LLMProvider.Together,
    deepseek: LLMProvider.DeepSeek,
  };
  return lookup[base_model] ?? LLMProvider.Custom;
}

/**
 * Sets the local API keys for the revelant LLM API(s).
 */
export function set_api_keys(api_keys: Dict<string>): void {
  function key_is_present(name: string): boolean {
    return (
      (name in api_keys &&
        api_keys[name] &&
        api_keys[name].trim().length > 0) ||
      name === "OpenAI_BaseURL"
    );
  }
  if (key_is_present("OpenAI")) OPENAI_API_KEY = api_keys.OpenAI;
  if (key_is_present("OpenAI_BaseURL"))
    OPENAI_BASE_URL = api_keys.OpenAI_BaseURL;
  if (key_is_present("HuggingFace")) HUGGINGFACE_API_KEY = api_keys.HuggingFace;
  if (key_is_present("Anthropic")) ANTHROPIC_API_KEY = api_keys.Anthropic;
  if (key_is_present("Google")) GOOGLE_PALM_API_KEY = api_keys.Google;
  if (key_is_present("Azure_OpenAI")) AZURE_OPENAI_KEY = api_keys.Azure_OpenAI;
  if (key_is_present("Azure_OpenAI_Endpoint"))
    AZURE_OPENAI_ENDPOINT = api_keys.Azure_OpenAI_Endpoint;
  if (key_is_present("AlephAlpha")) ALEPH_ALPHA_API_KEY = api_keys.AlephAlpha;
  if (key_is_present("AlephAlpha_BaseURL"))
    ALEPH_ALPHA_BASE_URL = api_keys.AlephAlpha_BaseURL;
  // Soft fail for non-present keys
  if (key_is_present("AWS_Access_Key_ID"))
    AWS_ACCESS_KEY_ID = api_keys.AWS_Access_Key_ID;
  if (key_is_present("AWS_Secret_Access_Key"))
    AWS_SECRET_ACCESS_KEY = api_keys.AWS_Secret_Access_Key;
  if (key_is_present("AWS_Session_Token"))
    AWS_SESSION_TOKEN = api_keys.AWS_Session_Token;
  if (key_is_present("AWS_Region")) AWS_REGION = api_keys.AWS_Region;
  if (key_is_present("Together")) TOGETHER_API_KEY = api_keys.Together;
  if (key_is_present("DeepSeek")) DEEPSEEK_API_KEY = api_keys.DeepSeek;
}

export const deepcopy = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function extract_llm_provider(llm_spec: LLMSpec): LLMProvider {
  return baseModelToProvider(llm_spec.base_model);
}

export function to_standard_format(
  r: RawLLMResponseObject | Dict,
): LLMResponse {
  const resp_obj: LLMResponse = {
    vars: r.vars,
    metavars: r.metavars ?? {},
    llm: r.llm,
    prompt: r.prompt,
    responses: r.responses,
    tokens: r.tokens ?? {},
    uid: r.uid ?? uuid(),
  };
  if ("eval_res" in r) resp_obj.eval_res = r.eval_res;
  if ("chat_history" in r) resp_obj.chat_history = r.chat_history;
  return resp_obj;
}
