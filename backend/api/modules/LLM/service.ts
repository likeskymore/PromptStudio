import CancelTracker from "./canceler";
import { set_api_keys } from "../../ChainForgeUtils/utils";
import {
  Dict,
  Llm,
  Llm_params,
  LLMPrompterResults,
  LLMResponse,
  LLMResponseError,
  LLMSpec,
  QueryProgress,
  RawLLMResponseObject,
} from "./types";
import { deepcopy, extract_llm_provider, to_standard_format } from "./utils";
import { PromptPipeline } from "../../ChainForgeUtils/query";
import { LLM } from "./models";
import { UserForcedPrematureExit } from "../../ChainForgeUtils/errors";
import { PromptVarsDict } from "../experiment_config/types";
import { LlmRepository } from "./repository";
import { DatabaseClient, prisma } from "../../../database/prisma";

export const LlmService = {
  /**
 * Queries LLM(s) with root prompt template `prompt` and prompt input variables `vars`, `n` times per prompt.
 * Soft-fails if API calls fail, and collects the errors in `errors` property of the return object.
 * 
 * @param id a unique ID to refer to this information. Used when cache'ing responses. 
 * @param llm a string, list of strings, or list of LLM spec dicts specifying the LLM(s) to query.
 * @param n the amount of generations for each prompt. All LLMs will be queried the same number of times 'n' per each prompt.
 * @param prompt the prompt template, with any {} vars
 * @param vars a dict of the template variables to fill the prompt template with, by name. 
               For each var, can be single values or a list; in the latter, all permutations are passed. (Pass empty dict if no vars.)
 * @param chat_histories Either an array of `ChatHistory` (to use across all LLMs), or a dict indexed by LLM nicknames of `ChatHistory` arrays to use per LLM. 
 * @param api_keys (optional) a dict of {api_name: api_key} pairs. Supported key names: OpenAI, Anthropic, Google
 * @param no_cache (optional) if true, deletes any cache'd responses for 'id' (always calls the LLMs fresh)
 * @param progress_listener (optional) a callback whenever an LLM response is collected, on the current progress
 * @param cont_only_w_prior_llms (optional) whether we are continuing using prior LLMs
 * @param cancel_id (optional) the id that would appear in CancelTracker if the user cancels the querying (NOT the same as 'id' --must be unique!)
 * @returns a dictionary in format `{responses: LLMResponse[], errors: string[]}`
 */
  async queryLLM(
    id: string,
    llm: string | (string | LLMSpec)[],
    n: number,
    prompt: string,
    vars: PromptVarsDict,
    api_keys?: Dict,
    no_cache?: boolean,
    progress_listener?: (progress: { [key: symbol]: any }) => void,
    cont_only_w_prior_llms?: boolean,
    cancel_id?: string | number,
  ): Promise<{ responses: LLMResponse[]; errors: Dict<LLMResponseError[]> }> {
    // Verify the integrity of the params
    if (typeof id !== "string" || id.trim().length === 0)
      throw new Error("id is improper format (length 0 or not a string)");

    if (Array.isArray(llm) && llm.length === 0)
      throw new Error(
        "POST data llm is improper format (not string or list, or of length 0).",
      );

    // Ensure llm param is an array
    if (typeof llm === "string") llm = [llm];

    // Cast and deep copy these objects as they may be modified
    llm = deepcopy(llm) as string[] | LLMSpec[];
    vars = deepcopy(vars);

    if (api_keys !== undefined) set_api_keys(api_keys);

    const llms = llm;

    // Create a Proxy object to 'listen' for changes to a variable (see https://stackoverflow.com/a/50862441)
    // and then stream those changes back to a provided callback used to update progress bars.
    const progress: { [key: string | symbol]: QueryProgress } = {};
    const progressProxy = new Proxy(progress, {
      set: function (target, key, value) {
        target[key] = value;

        // If the caller provided a callback, notify it
        // of the changes to the 'progress' object:
        if (progress_listener) progress_listener(target);

        return true;
      },
    });

    // Helper function to check whether this process has been canceled
    const should_cancel = () =>
      cancel_id !== undefined && CancelTracker.has(cancel_id);

    // For each LLM, generate and cache responses:
    const responses: { [key: string]: Array<RawLLMResponseObject> } = {};
    const all_errors: Dict<LLMResponseError[]> = {};
    const num_generations = n ?? 1;
    async function query(llm_spec: LLMSpec): Promise<LLMPrompterResults> {
      // Get LLM model name and any params
      const llm_provider = extract_llm_provider(llm_spec);
      const temperature: number =
        llm_spec.temp !== undefined ? llm_spec.temp : 1.0;
      let _vars = vars;

      const prompter = new PromptPipeline(prompt);

      // Prompt the LLM with all permutations of the input prompt template:
      // NOTE: If the responses are already cache'd, this just loads them (no LLM is queried, saving $$$)
      const resps: Array<RawLLMResponseObject> = [];
      const errors: Array<LLMResponseError> = [];
      let num_resps = 0;
      let num_errors = 0;

      try {
        // Yield responses for 'llm' for each prompt generated from the root template 'prompt' and template variables in 'properties':
        for await (const response of prompter.gen_responses(
          _vars,
          llm_spec.base_model as LLM,
          llm_provider,
          num_generations,
          temperature,
          undefined,
          [undefined],
          should_cancel,
        )) {
          // Check for selective failure
          if (response instanceof LLMResponseError) {
            // The request failed
            /*          console.error(
            `error when fetching response from ${llm_spec.base_model}: ${response.message}`,
          );*/
            num_errors += 1;
            errors.push(response);
          } else {
            // The request succeeded
            response.llm = llm_spec;
            num_resps += response.responses.length;
            resps.push(response);
          }

          // Update the current 'progress' for this llm.
          // (this implicitly triggers any callbacks defined in the Proxy)
          // progressProxy[llm_key] = {
          //  success: num_resps,
          //  error: num_errors,
          // };
        }
      } catch (e) {
        if (e instanceof UserForcedPrematureExit) {
          throw e;
        } else {
          console.error(
            `Error generating responses for ${llm_spec.base_model}: ${(e as Error).message}`,
          );
          throw e;
        }
      }

      return {
        llm_key: llm_spec.base_model,
        responses: resps,
        errors,
      };
    }

    // Request responses simultaneously across LLMs
    const tasks: Array<Promise<LLMPrompterResults>> = llms.map(query);

    // Await the responses from all queried LLMs
    const llm_results = await Promise.all(tasks);
    llm_results.forEach((result) => {
      responses[result.llm_key] = result.responses;
      if (result.errors.length > 0) all_errors[result.llm_key] = result.errors;
    });

    // Convert the responses into a more standardized format with less information
    const res = Object.values(responses).flatMap((rs) =>
      rs.map(to_standard_format),
    );

    // Return all responses for all LLMs
    return {
      responses: res,
      errors: all_errors,
    };
  },
  build_LLM_Params(llm: LLMSpec): Partial<Llm_params> {
    const llm_params: Partial<Llm_params> = {};
    const custom_params: Record<string, string> = {};

    const known = [
      "max_tokens",
      "top_p",
      "top_k",
      "stop_sequence",
      "frequency_penalty",
      "presence_penalty",
    ];

    const native = [
      "name",
      "model",
      "temp",
      "base_model",
      "settings",
      "emoji",
      "key",
    ];

    if (llm.temp !== undefined) {
      llm_params.temperature = llm.temp;
    }
    for (const [k, v] of Object.entries(llm)) {
      if (known.includes(k)) {
        (llm_params as any)[k] = v;
      } else if (!native.includes(k) && v !== undefined) {
        if (typeof v === "object") {
          custom_params[k] = JSON.stringify(v);
        } else {
          custom_params[k] = String(v);
        }
      }
    }

    if (Object.keys(custom_params).length > 0) {
      llm_params.custom_params = custom_params;
    }

    return llm_params;
  },
  /**
   * Creates a specification for the LLM based on the provided parameters.
   * @param llm The LLMSpec object containing the LLM details.
   * @param llm_param The Llm_params object containing the parameters for the LLM.
   */
  create_llm_spec(llm: LLMSpec, llm_param: Llm_params): LLMSpec {
    const settings: any = {
      ...(llm_param.max_tokens !== undefined && {
        max_tokens: llm_param.max_tokens,
      }),
      ...(llm_param.top_p !== undefined && { top_p: llm_param.top_p }),
      ...(llm_param.top_k !== undefined && { top_k: llm_param.top_k }),
      ...(llm_param.stop_sequence !== undefined && {
        stop_sequence: llm_param.stop_sequence,
      }),
      ...(llm_param.frequency_penalty !== undefined && {
        frequency_penalty: llm_param.frequency_penalty,
      }),
      ...(llm_param.presence_penalty !== undefined && {
        presence_penalty: llm_param.presence_penalty,
      }),
      ...llm_param.custom_params,
    };

    return {
      name: llm.name,
      model: llm.model,
      temp: llm_param.temperature ?? 0,
      base_model: llm.base_model,
      settings,
    };
  },
  async get_llm_by_base_model(
    base_model: string,
    connection: DatabaseClient = prisma,
  ): Promise<Llm | undefined> {
    const llm = await LlmRepository.get_llm_by_base_model(
      base_model,
      connection,
    );
    if (!llm) return undefined;
    return llm;
  },
  async handle_save_llm(
    llm: LLMSpec,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    const result = await LlmRepository.save_llm(llm, connection);
    return result;
  },
  async handle_save_llm_param(
    llm_params: Partial<Llm_params>,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    const result = await LlmRepository.save_llm_param(llm_params, connection);
    return result;
  },
  async get_llm_by_id(
    llm_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<LLMSpec | undefined> {
    const llm = await LlmRepository.get_llm_by_id(llm_id, connection);
    if (!llm) return undefined;
    return llm;
  },
  async get_llm_param_by_id(
    llm_param_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Llm_params> {
    try {
      const llm_param = await LlmRepository.get_llm_param_by_id(
        llm_param_id,
        connection,
      );
      return llm_param;
    } catch (error) {
      console.error("Error fetching LLM param by ID:", error);
      throw error;
    }
  },
};
