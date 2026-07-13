import * as workerpool from 'workerpool';
import {queryLLM} from "../backend";
import {
    get_evaluator_by_id, get_processor_by_id,
    get_child_evaluator_ids_by_multi_eval_id,
    save_error, save_error_evaluator, save_error_processor, save_eval_result, save_process_result,
    save_response,
    get_llm_evaluator_by_id,
    get_llm_param_by_id, 
} from "../database/database";
import { LLMSpec, PromptVarsDict} from "../typing";
import {execute_javascript, execute_python} from "./evaluator";
import {ExperimentProcessor, Result, Eval_type, Processor_type, ResolvedInput} from "./types";
import {execute_join, execute_split } from './processor';
import { fillTemplate } from './configHandler';

/** 
 * Processes an experiment by querying the LLM with the given parameters and saving the responses.
 * This function is designed to be run in a worker thread, allowing for parallel processing.
 * @param config_id The ID of the configuration to use for the experiment.
 * @param llm_spec The specification of the LLM to use for the experiment.
 * @param iterations The number of iterations to run the experiment for.
 * @param template_value The template value to use for the LLM query.
 * @param markersDict A dictionary of markers to use in the LLM query.
 * @param input_id The ID of the input to use for the experiment.
 * @param tries The current number of tries for the experiment, used for retry logic.
 * @param api_keys A dictionary of API keys to use for the LLM query.
 */
async function processExperiment(config_id: number, llm_spec: LLMSpec, iterations: number,
                                 template_value: string, markersDict: PromptVarsDict,
                                 input_id: number, api_keys: string, tries: number = 0 ): Promise<{success: boolean, tries: number}> {
    let safe_api_keys = {};
    if (api_keys){
        safe_api_keys = JSON.parse(api_keys);
    }
    const start_time = new Date().toISOString().replace('T', ' ').replace('Z', ' ');
    const responses = await queryLLM(
        config_id.toString(),
        [llm_spec],
        iterations,
        template_value,
        markersDict,
        safe_api_keys);
    const end_time = new Date().toISOString().replace('T', ' ').replace('Z', ' ');
    for (const response of responses.responses) {
        for (const llm_response of response.responses) {
            await save_response(config_id, llm_response, input_id, start_time, end_time, response.tokens.total_tokens / responses.responses.length);
        }
    }
    if (responses.errors && Object.keys(responses.errors).length > 0){
        for (const key of Object.keys(responses.errors)) {
            for (const err of responses.errors[key]) {
                await save_error(config_id, err.message, err.getStatus() || 0, input_id, start_time, end_time);
                tries++;
                return {success: false, tries: tries};
            }
        }
    }
    return {success: true, tries: tries};
}

/**
 * Evaluates a result using the specified evaluator.
 * This function executes the evaluator's code and saves the evaluation result or error.
 * It is designed to be run in a worker thread, allowing for parallel processing.
 * @param evaluator_id The ID of the evaluator to use for the evaluation.
 * @param LLMSpec The specification of the LLM to use for the evaluation.
 * @param markersDict A dictionary of markers to use in the evaluation.
 * @param template_value The template value to use for the evaluation.
 * @param result The result to evaluate, which contains the response from the LLM.
 * @param input_id The ID of the input associated with the evaluator.
 */
async function evaluate(evaluator_id: number, LLMSpec: LLMSpec, markersDict: PromptVarsDict, template_value: string, result: Result, input_id: number) {
    const evaluator = await get_evaluator_by_id(evaluator_id);
    const llmName = LLMSpec?.base_model ?? "";
    const prompt = template_value ?? "";
    let eval_result;
    // If evaluator is a multieval, find its child evaluators and run them sequentially
    if (evaluator?.type === Eval_type.multieval) {
        const child_ids = await get_child_evaluator_ids_by_multi_eval_id(evaluator.node_id);
        for (const child_id of child_ids) {
            await evaluate(child_id, LLMSpec, markersDict, template_value, result, input_id);
        }
        return; // Exit after processing all child evaluators
    }
    if (evaluator?.type === Eval_type.llm) {
        const llmEvaluator = await get_llm_evaluator_by_id(evaluator.node_id);
        try {
            const graderSpec: any = await get_llm_param_by_id(llmEvaluator.llm_param_id);
            const gradingPromptTemplate: string = llmEvaluator.prompt ?? '{response}';

            const evalVars = { ...markersDict, response: result.output_result } as PromptVarsDict;
            const gradingPrompt = fillTemplate(gradingPromptTemplate, evalVars);
            
            const responses = await queryLLM(llmEvaluator.node_id.toString(), [graderSpec], 1, gradingPrompt, evalVars, {});
            const firstResp = responses.responses && responses.responses.length > 0 ? responses.responses[0] : undefined;
            const graderOut = firstResp && firstResp.responses && firstResp.responses.length > 0 ? firstResp.responses[0] : undefined;
            if (!graderOut) {
                await save_error_evaluator(llmEvaluator.node_id, 'No grader output', result.id, input_id, new Date().toISOString().replace('T', ' ').replace('Z', ' '));
                return;
            }
            await save_eval_result(graderOut, result.id, input_id, llmEvaluator.node_id);
        } catch (err) {
            await save_error_evaluator(llmEvaluator.node_id, String(err), result.id, input_id, new Date().toISOString().replace('T', ' ').replace('Z', ' '));
        }
        return;
    }

    if (evaluator?.type === Eval_type.python) {
        eval_result = await execute_python(evaluator.code, result, markersDict, {}, llmName, prompt, "evaluator");
    } else {
        eval_result = await execute_javascript(evaluator.code, result, markersDict, {}, llmName, prompt, "evaluator");
    }
    // Check if there is an error in the evaluator itself
    if (eval_result.error) {
        await save_error_evaluator(evaluator.node_id, eval_result.error, result.id, input_id, new Date().toISOString().replace('T', ' ').replace('Z', ' '),);
        return;
    }
    // Check if there is an error in the evaluation result
    if (eval_result.response.error) {
        await save_error_evaluator(evaluator.node_id, eval_result.response.error, eval_result.response.result_id, input_id, new Date().toISOString().replace('T', ' ').replace('Z', ' '));
    } else {
        const result = eval_result.response.result;
        if (result !== null && result !== undefined) {
            await save_eval_result(result, eval_result.response.result_id, input_id, evaluator.node_id);
        }
    }
}

/**
 * Processes a result using the specified processor.
 * This function executes the processor's code and saves the processed result or error.
 * It is designed to be run in a worker thread, allowing for parallel processing.
 * Result or input_id can be null, input_id is used if we want to process a dataset directly which means we wouldn't have a result
 * If we process results we then only have result and no input_id
 * @param processor_id The ID of the processor to use for processing the result.
 * @param LLMSpec The specification of the LLM to use for processing.
 * @param markersDict A dictionary of markers to use in the processing.
 * @param template_value The template value to use for the processing.
 * @param result The result to process, which contains the response from the LLM.
 * @param input_id The ID of the input associated with the processor.
 * @param resolved_input_id The ID of the resolved input associated with the processor.
 * @param resolved_inputs An array of resolved inputs associated with the processor.
 */
async function process(processor_id: number, LLMSpec: LLMSpec,  markersDict: PromptVarsDict, template_value: string, result: Result, input_id: number, resolved_input_id: number | null, resolved_inputs: ResolvedInput[] | null) {
    const processor: ExperimentProcessor = await get_processor_by_id(processor_id);
    const llmName = LLMSpec?.base_model ?? "";
    const prompt = template_value ?? "";
    let process_result;
    if (processor?.type === Processor_type.python) {
        process_result = await execute_python(processor.code, result, markersDict, {}, llmName, prompt, "processor");
    } else if (processor?.type === Processor_type.join){
        process_result = await execute_join(processor.selected_group_vars, resolved_inputs, processor.format);
        for (const result of process_result || []) {
            await save_process_result(result.response?.result, result.response?.result_id || null, processor.node_id, result.response?.input_id || null, resolved_input_id);
        }
        return;
    } else if (processor?.type === Processor_type.split){
        process_result = await execute_split(result, markersDict, {}, llmName, prompt, "processor", processor.format);
    } else {
        process_result = await execute_javascript(processor.code, result, markersDict, {}, llmName, prompt, "processor");
    }
    // Check if there is an error in the processor itself
    if (process_result.error) {
        await save_error_processor(processor.node_id, process_result.error, result.id || null, input_id || null, resolved_input_id || null, new Date().toISOString().replace('T', ' ').replace('Z', ' '),);
        return;
    }
    // Check if there is an error in the process result
    if (process_result.response.error) {
        await save_error_processor(processor.node_id, process_result.response.error, process_result.response.result_id || null, input_id || null, resolved_input_id || null, new Date().toISOString().replace('T', ' ').replace('Z', ' '));
    } else {
        let result = process_result.response.result;
        await save_process_result(result, result.response.result_id || null, processor.node_id, input_id, resolved_input_id);

    }
}

workerpool.worker({
    processExperiment: processExperiment,
    evaluate: evaluate,
    process: process,
});