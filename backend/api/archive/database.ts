// import type { ExperimentRunState } from "../api/types";
// import * as crypto from "crypto";
// import { DatabaseClient, getClient, prisma } from "./prisma";
// import type { Prisma } from "../../generated/prisma/client";
// import { LLMSpec, PromptVarsDict } from "../api/modules/LLM/types";

// /**
//  * Saves a prompt template to the database.
//  * This function inserts a template into the PromptTemplate table and associates any sub-templates with it.
//  * @param template The prompt template string to be saved.
//  * @param name The name of the template.
//  * @param iterations The number of iterations for the template.
//  * @param node_id The ID of the node associated with this template.
//  * @param connection
//  * @return The ID of the newly created template.
//  */
// export async function save_template(
//   template: string,
//   name: string,
//   iterations: number,
//   node_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     await getClient(connection).promptTemplate.create({
//       data: { nodeId: node_id, value: template, name, iterations },
//     });
//     return node_id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Saves an experiment to the database.
//  * This function inserts an experiment into the Experiment table.
//  * @param experiment The Experiment object containing details of the experiment.
//  * @param connection
//  * @returns The ID of the newly created experiment.
//  */
// export async function save_experiment(
//   experiment: Experiment,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     const result = await getClient(connection).experiment.create({
//       data: {
//         title: experiment.title,
//         maxRetry: experiment.max_retry,
//         threads: experiment.threads,
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Saves a new LLM specification to the database.
//  * @param llm The LLMSpec object containing details of the LLM.
//  * @param connection
//  * @returns The ID of the newly created LLM.
//  */
// export async function save_llm(
//   llm: LLMSpec,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     // Check if the LLM already exists
//     const existingLlm = await get_llm_by_base_model(llm.base_model, connection);
//     if (existingLlm) {
//       // If it exists, return its ID
//       return existingLlm.id;
//     }
//     const result = await getClient(connection).llm.create({
//       data: { baseModel: llm.base_model, name: llm.name, model: llm.model },
//     });
//     return result.id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Saves LLM parameters to the database.
//  * This function inserts the parameters into the llm_param table and saves any custom parameters in llm_custom_param.
//  * @param llm_params The Llm_params object containing the parameters to be saved.
//  * @param connection
//  * @returns The ID of the newly created LLM parameters.
//  */
// export async function save_llm_param(
//   llm_params: Partial<Llm_params>,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     const data = {
//       temperature: llm_params.temperature,
//       maxTokens: llm_params.max_tokens,
//       topP: llm_params.top_p,
//       topK: llm_params.top_k,
//       stopSequence: llm_params.stop_sequence,
//       frequencyPenalty: llm_params.frequency_penalty,
//       presencePenalty: llm_params.presence_penalty,
//     };
//     if (Object.values(data).every((value) => value === undefined)) {
//       throw new Error("No valid parameters provided");
//     }
//     const result = await getClient(connection).llmParam.create({ data });

//     // Save custom parameters if provided
//     if (llm_params.custom_params !== undefined) {
//       await getClient(connection).llmCustomParam.createMany({
//         data: Object.entries(llm_params.custom_params).map(([name, value]) => ({
//           name,
//           value: String(value),
//           llmParamId: result.id,
//         })),
//       });
//     }

//     return result.id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Saves a prompt configuration to the database.
//  * This function inserts a new prompt configuration into the promptconfig table.
//  * @param experiment_id The ID of the experiment associated with this configuration.
//  * @param llm_id The ID of the LLM used in this configuration.
//  * @param llm_param_id The ID of the LLM parameters used in this configuration.
//  * @param template_id The ID of the prompt template used in this configuration.
//  * @param dataset_id The ID of the dataset used in this configuration.
//  * @param connection
//  * @returns The ID of the newly created prompt configuration.
//  */
// export async function save_promptconfig(
//   experiment_id: number,
//   llm_id: number,
//   llm_param_id: number,
//   template_id: number,
//   dataset_id: number | null,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     const result = await getClient(connection).promptConfig.create({
//       data: {
//         experimentId: experiment_id,
//         llmId: llm_id,
//         llmParamId: llm_param_id,
//         promptTemplateId: template_id,
//         finalDatasetId: dataset_id,
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Retrieves all prompt configurations associated with a specific experiment.
//  * @param experiment_id The ID of the experiment for which to retrieve prompt configurations.
//  * @param connection
//  * @returns An array of Promptconfig objects associated with the specified experiment.
//  */
// export async function get_prompt_config_by_experiment(
//   experiment_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Promptconfig[]> {
//   try {
//     const rows = await getClient(connection).promptConfig.findMany({
//       where: { experimentId: experiment_id },
//     });
//     return rows as unknown as Promptconfig[];
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }
// /**
//  * Retrieves an experiment by its name.
//  * @param experiment_name The name of the experiment to retrieve.
//  * @param connection
//  * @returns The Experiment object if found, otherwise undefined.
//  */
// export async function get_experiment_run_state_by_experiment_name(
//   experiment_name: string,
//   connection: DatabaseClient = prisma,
// ): Promise<ExperimentRunState | undefined> {
//   try {
//     const row = await getClient(connection).experimentRun.findFirst({
//       where: { experimentName: experiment_name },
//     });
//     return row as unknown as ExperimentRunState | undefined;
//   } catch (error) {
//     console.error(error);
//   }
// }

// /**
//  * Retrieves an LLM specification by its ID.
//  * This function fetches the LLM details from the database using the provided LLM ID.
//  * @param llm_id The ID of the LLM to retrieve.
//  * @param connection
//  * @return The LLMSpec object if found, otherwise undefined.
//  */
// export async function get_llm_by_id(
//   llm_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<LLMSpec | undefined> {
//   try {
//     const row = await getClient(connection).llm.findUnique({
//       where: { id: llm_id },
//     });
//     return row as unknown as LLMSpec | undefined;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Retrieves LLM parameters by their ID.
//  * This function fetches the LLM parameters from the database using the provided LLM parameter ID.
//  * It also retrieves any custom parameters associated with the LLM parameter.
//  * @param llm_param_id The ID of the LLM parameter to retrieve.
//  * @param connection
//  * @return The Llm_params object if found, otherwise undefined.
//  */
// export async function get_llm_param_by_id(
//   llm_param_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Llm_params> {
//   try {
//     const row = await getClient(connection).llmParam.findUnique({
//       where: { id: llm_param_id },
//       include: { customParams: true },
//     });
//     if (!row) return undefined as unknown as Llm_params;
//     return {
//       id: row.id,
//       temperature: row.temperature ?? undefined,
//       max_tokens: row.maxTokens ?? undefined,
//       top_p: row.topP ?? undefined,
//       top_k: row.topK ?? undefined,
//       stop_sequence: row.stopSequence ?? undefined,
//       frequency_penalty: row.frequencyPenalty ?? undefined,
//       presence_penalty: row.presencePenalty ?? undefined,
//       custom_params: Object.fromEntries(
//         row.customParams.map((param) => [param.name, param.value]),
//       ),
//     };
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Retrieves a prompt template by its ID.
//  * @param template_id The ID of the prompt template to retrieve.
//  * @param connection
//  * @return The prompttemplate object if found, otherwise undefined.
//  */
// export async function get_prompt_template_by_id(
//   template_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<PromptTemplate | undefined> {
//   try {
//     const row = await getClient(connection).promptTemplate.findUnique({
//       where: { node_id: template_id },
//     });
//     return row as unknown as PromptTemplate | undefined;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// /**
//  * Fetches an input along with its associated markers from the database.
//  * @param input_id The ID of the input to fetch.
//  * @param connection
//  * @return An Input object containing the input ID and its associated markers.
//  */
// async function fetch_input_with_markers(
//   input_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Input> {
//   const row = await getClient(connection).dataInput.findUnique({
//     where: { id: input_id },
//     include: { inputMarkers: { include: { markerValue: true } } },
//   });
//   return {
//     id: input_id,
//     markers:
//       row?.inputMarkers.map(({ markerValue }) => ({
//         id: markerValue.id,
//         marker_id: markerValue.markerId,
//         value: markerValue.value,
//       })) ?? [],
//   };
// }

// /**
//  * Retrieves an input by its ID, including its associated markers.
//  * @param input_id The ID of the input to retrieve.
//  * @param connection
//  * @return An Input object if found, otherwise undefined.
//  */
// export async function get_input_by_id(
//   input_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Input | undefined> {
//   try {
//     const exists = await getClient(connection).dataInput.findUnique({
//       where: { id: input_id },
//       select: { id: true },
//     });
//     return exists
//       ? await fetch_input_with_markers(input_id, connection)
//       : undefined;
//   } catch (error) {
//     console.error(error);
//     return undefined;
//   }
// }

// export async function get_marker_by_id(
//   marker_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<string> {
//   try {
//     const row = await getClient(connection).marker.findUnique({
//       where: { id: marker_id },
//       select: { marker: true },
//     });
//     return row?.marker as string;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// export async function save_response(
//   run_id: string,
//   config_id: number,
//   output_result: string,
//   input_id: number,
//   start_time: string,
//   end_time: string,
//   total_tokens: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const result = await getClient(connection).result.create({
//       data: {
//         runId: run_id,
//         configId: config_id,
//         outputResult: output_result,
//         inputId: input_id,
//         startTime: new Date(start_time),
//         endTime: new Date(end_time),
//         totalTokens: total_tokens,
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error(error);
//   }
// }

// export async function save_error(
//   config_id: number,
//   error_message: string,
//   error_status: number,
//   input_id: number,
//   start_time: string,
//   end_time: string,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     const result = await getClient(connection).error.create({
//       data: {
//         configId: config_id,
//         errorMessage: error_message,
//         errorCode: error_status,
//         inputId: input_id,
//         startTime: new Date(start_time),
//         endTime: new Date(end_time),
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// export async function get_results_for_run(
//   run_id: string,
//   config_id: number,
//   input_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Result[]> {
//   try {
//     const rows = await getClient(connection).result.findMany({
//       where: { runId: run_id, configId: config_id, inputId: input_id },
//     });
//     return rows.map((row) => ({
//       id: row.id,
//       run_id: row.runId ?? undefined,
//       config_id: row.configId,
//       output_result: row.outputResult,
//       input_id: row.inputId,
//       start_time: row.startTime,
//       end_time: row.endTime,
//     })) as Result[];
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// export async function get_llm_by_base_model(
//   base_model: string,
//   connection: DatabaseClient = prisma,
// ): Promise<Llm> {
//   try {
//     const result = await getClient(connection).llm.findUnique({
//       where: { baseModel: base_model },
//     });
//     return result as unknown as Llm;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// export async function save_evaluator(
//   evaluator: Evaluator,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     await getClient(connection).evaluator.create({
//       data: {
//         nodeId: evaluator.node_id,
//         type: evaluator.type as any,
//         code: evaluator.code ?? null,
//         name: evaluator.name,
//         returnType: evaluator.return_type as any,
//       },
//     });
//     return evaluator.node_id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// export async function save_simple_evaluator(
//   evaluator: SimpleEvaluator,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     await getClient(connection).simpleEvaluator.create({
//       data: {
//         nodeId: evaluator.node_id,
//         textValue: evaluator.text_value,
//         varValue: evaluator.var_value,
//         varType: evaluator.var_type,
//         varSelected: evaluator.var_selected,
//       },
//     });
//     return evaluator.node_id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// export async function save_llm_evaluator(
//   evaluator: LlmEvaluator,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     await getClient(connection).llmEvaluator.create({
//       data: {
//         nodeId: evaluator.node_id,
//         name: evaluator.name,
//         llmParamId: evaluator.llm_param_id,
//         llmId: evaluator.llm_id,
//         format: evaluator.format,
//         prompt: evaluator.prompt,
//         reasonBeforeScoring: evaluator.reason_before_scoring,
//       },
//     });
//     return evaluator.node_id;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// }

// export async function save_multi_evaluator_mapping(
//   mappings: [number, number][],
//   connection: DatabaseClient = prisma,
// ): Promise<void> {
//   await getClient(connection).multiEvaluator.createMany({
//     data: mappings.map(([evaluatorId, childEvaluatorId]) => ({
//       evaluatorId,
//       childEvaluatorId,
//     })),
//   });
// }

// export async function save_processor(
//   processor: ExperimentProcessor,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     await getClient(connection).processor.create({
//       data: {
//         nodeId: processor.node_id,
//         type: processor.type as any,
//         code: processor.code ?? null,
//         format: processor.format ?? null,
//         selectedGroupVars: processor.selected_group_vars ?? null,
//         name: processor.name,
//       },
//     });
//     return processor.node_id;
//   } catch (error) {
//     throw error;
//   }
// }

// function computeMarkerValueHash(marker_id: number, value: string): string {
//   return crypto
//     .createHash("sha256")
//     .update(`${marker_id}${value}`)
//     .digest("hex");
// }

// export async function get_results_by_template(
//   template_id: string,
//   connection: DatabaseClient = prisma,
// ): Promise<Result[]> {
//   try {
//     const rows = await getClient(connection).result.findMany({
//       where: { config: { promptTemplateId: Number(template_id) } },
//     });
//     return rows.map((row) => ({
//       id: row.id,
//       run_id: row.runId ?? undefined,
//       config_id: row.configId,
//       output_result: row.outputResult,
//       input_id: row.inputId,
//       start_time: row.startTime,
//       end_time: row.endTime,
//     })) as Result[];
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// export async function get_config(
//   config_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Promptconfig | undefined> {
//   try {
//     const row = await getClient(connection).promptConfig.findUnique({
//       where: { id: config_id },
//     });
//     return row
//       ? {
//           id: row.id,
//           experiment_id: row.experimentId,
//           LLM_id: row.llmId,
//           LLM_param_id: row.llmParamId,
//           prompt_template_id: row.promptTemplateId,
//           final_dataset_id: row.finalDatasetId as number,
//           datasets: [],
//         }
//       : undefined;
//   } catch (error) {
//     console.error(error);
//   }
// }

// export async function save_eval_result(
//   eval_result: unknown,
//   result_id: number,
//   input_id: number,
//   evaluator_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const result = await getClient(connection).evaluationsResult.create({
//       data: {
//         evaluationResult: String(eval_result),
//         resultId: result_id ?? null,
//         inputId: input_id ?? null,
//         evaluatorId: evaluator_id,
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error("Error saving evaluation result:", error);
//   }
// }

// export async function get_evaluation_result(
//   result_id: number,
//   evaluator_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<string | undefined> {
//   try {
//     const row = await getClient(connection).evaluationsResult.findFirst({
//       where: { resultId: result_id, evaluatorId: evaluator_id },
//       select: { evaluationResult: true },
//     });
//     return row?.evaluationResult;
//   } catch (error) {
//     console.error("Error fetching evaluation result:", error);
//   }
// }

// export async function save_error_evaluator(
//   evaluator_id: number,
//   error_message: string,
//   result_id: number,
//   input_id: number,
//   timestamp: string,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const result = await getClient(connection).errorEvaluator.create({
//       data: {
//         evaluatorId: evaluator_id,
//         errorMessage: error_message,
//         resultId: result_id ?? null,
//         inputId: input_id ?? null,
//         timestamp: new Date(timestamp),
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error("Error saving error evaluator:", error);
//   }
// }

// export async function save_node(
//   type: string,
//   experiment_id: number,
//   name: string,
//   connection: DatabaseClient = prisma,
// ): Promise<number> {
//   try {
//     const result = await getClient(connection).node.create({
//       data: { type: type as any, experimentId: experiment_id, name },
//     });
//     return result.id;
//   } catch (error) {
//     throw error;
//   }
// }

// export async function get_node_by_name(
//   name: string,
//   experiment_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Experiment_node | undefined> {
//   try {
//     const result = await getClient(connection).node.findUnique({
//       where: { experimentId_name: { name, experimentId: experiment_id } },
//     });
//     return result as unknown as Experiment_node | undefined;
//   } catch (error) {
//     console.error("Error fetching node by name:", error);
//   }
// }

// export async function save_link(
//   source_node_id: number,
//   target_node_id: number,
//   source_var: string | null,
//   target_var: string | null,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     if (target_var === null)
//       throw new Error("A link target variable is required");
//     await getClient(connection).link.create({
//       data: {
//         sourceNodeId: source_node_id,
//         targetNodeId: target_node_id,
//         sourceVar: source_var,
//         targetVar: target_var,
//       },
//     });
//   } catch (error) {
//     console.error("Error saving link:", error);
//   }
// }

// export async function get_configs_by_template_id(
//   template_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Promptconfig[]> {
//   try {
//     const rows = await getClient(connection).promptConfig.findMany({
//       where: { promptTemplateId: template_id },
//     });
//     return rows.map((row) => ({
//       id: row.id,
//       experiment_id: row.experimentId,
//       LLM_id: row.llmId,
//       LLM_param_id: row.llmParamId,
//       prompt_template_id: row.promptTemplateId,
//       final_dataset_id: row.finalDatasetId as number,
//       datasets: [],
//     }));
//   } catch (error) {
//     console.error("Error fetching configs by template ID:", error);
//     return [];
//   }
// }

// export async function get_nodes_by_experiment(
//   experiment_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const rows = await getClient(connection).node.findMany({
//       where: { experimentId: experiment_id },
//     });
//     return rows.map((row) => ({
//       id: row.id,
//       type: row.type as any,
//       experiment_id: row.experimentId,
//       name: row.name,
//     })) as Experiment_node[];
//   } catch (error) {
//     console.error("Error fetching nodes by experiment:", error);
//     return [];
//   }
// }

// /**
//  * Fetches all links between nodes in a given experiment.
//  * Only includes links where both source and target nodes belong to the same experiment.
//  */
// export async function get_links_by_experiment(
//   experimentId: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Link[]> {
//   const rows = await getClient(connection).link.findMany({
//     where: { sourceNode: { experimentId }, targetNode: { experimentId } },
//   });
//   return rows.map((row) => ({
//     source_node_id: row.sourceNodeId,
//     target_node_id: row.targetNodeId,
//     source_var: row.sourceVar,
//     target_var: row.targetVar,
//   }));
// }

// export async function get_data_inputs_by_dataset(
//   dataset_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Record<number, PromptVarsDict>> {
//   const rows = await getClient(connection).dataInput.findMany({
//     where: { datasetId: dataset_id },
//     include: {
//       inputMarkers: { include: { markerValue: { include: { marker: true } } } },
//     },
//   });
//   const grouped: Record<number, PromptVarsDict> = {};
//   for (const row of rows) {
//     grouped[row.id] = {};
//     for (const { markerValue } of row.inputMarkers) {
//       grouped[row.id][markerValue.marker.marker] = markerValue.value;
//     }
//   }
//   return grouped;
// }

// export async function update_final_dataset(
//   config_id: number,
//   dataset_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     await getClient(connection).promptConfig.update({
//       where: { id: config_id },
//       data: { finalDatasetId: dataset_id },
//     });
//   } catch (error) {
//     console.error("Error updating final dataset:", error);
//   }
// }

// async function inputExists(
//   node_id: number,
//   input: PromptVarsDict,
//   connection: DatabaseClient = prisma,
// ): Promise<boolean> {
//   const markerValueIds: number[] = [];
//   const client = getClient(connection);

//   for (const [marker, value] of Object.entries(input)) {
//     const markerRow = await client.marker.findFirst({
//       where: { marker, datasetId: node_id },
//     });
//     if (!markerRow) return false;

//     const hash = computeMarkerValueHash(markerRow.id, value);
//     const valueRow = await client.markerValue.findUnique({ where: { hash } });
//     if (!valueRow) return false;

//     markerValueIds.push(valueRow.id);
//   }

//   if (markerValueIds.length === 0) return false;
//   const candidates = await client.dataInput.findMany({
//     where: { datasetId: node_id },
//     include: { inputMarkers: true },
//   });
//   return candidates.some(
//     (candidate) =>
//       candidate.inputMarkers.length === markerValueIds.length &&
//       candidate.inputMarkers.every((marker) =>
//         markerValueIds.includes(marker.markerValuesId),
//       ),
//   );
// }

// export async function add_rows_to_dataset(
//   node_id: number,
//   inputs: PromptVarsDict[],
//   connection: DatabaseClient = prisma,
// ): Promise<void> {
//   const client = getClient(connection);
//   for (const input of inputs) {
//     // Check if input already exists
//     const exists = await inputExists(node_id, input, connection);
//     if (exists) continue;

//     const savedInput = await client.dataInput.create({
//       data: { datasetId: node_id },
//     });
//     for (const [marker, value] of Object.entries(input)) {
//       const markerRow = await client.marker.findFirst({
//         where: { marker, datasetId: node_id },
//       });
//       const markerRecord =
//         markerRow ??
//         (await client.marker.create({ data: { marker, datasetId: node_id } }));
//       const marker_id = markerRecord.id;
//       const hash = computeMarkerValueHash(marker_id, value);
//       const markerValue = await client.markerValue.upsert({
//         where: { hash },
//         update: {},
//         create: { markerId: marker_id, value, hash },
//       });
//       await client.inputMarker.create({
//         data: { inputId: savedInput.id, markerValuesId: markerValue.id },
//       });
//     }
//   }
// }

// export async function save_dataset_inputs(
//   inputs: PromptVarsDict[],
//   experiment_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const uuid: string = crypto.randomUUID();
//     const node_id = await save_node("dataset", experiment_id, uuid, connection);
//     await getClient(connection).dataset.create({
//       data: { nodeId: node_id, name: uuid },
//     });
//     await add_rows_to_dataset(node_id, inputs, connection);
//     return node_id;
//   } catch (error) {
//     console.error("Error saving dataset input:", error);
//   }
// }

// export async function save_resolved_input(
//   source_input_id: number,
//   value: string,
//   connection: DatabaseClient = prisma,
// ): Promise<number | undefined> {
//   try {
//     const result = await getClient(connection).resolvedInput.create({
//       data: { sourceInputId: source_input_id, value },
//     });
//     return result.id;
//   } catch (error) {
//     console.error("Error saving error processor:", error);
//   }
// }

// /**
//  * Retrieves the parent that are datasets of a given node.
//  * @param node_id
//  * @param type
//  * @param connection
//  * @return An array of id of datasets that are parents of the given node.
//  */
// export async function get_parents(
//   node_id: number,
//   type: string,
//   connection: DatabaseClient = prisma,
// ): Promise<number[]> {
//   try {
//     const rows = await getClient(connection).link.findMany({
//       where: { targetNodeId: node_id, sourceNode: { type: type as any } },
//       select: { sourceNodeId: true },
//       distinct: ["sourceNodeId"],
//     });
//     return rows.map((row) => row.sourceNodeId);
//   } catch (error) {
//     console.error("Error fetching parent datasets:", error);
//     return [];
//   }
// }

// export async function get_target_var(
//   source_id: number,
//   target_id: number,
//   source_var: string,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).link.findFirst({
//       where: {
//         sourceNodeId: source_id,
//         targetNodeId: target_id,
//         sourceVar: source_var,
//       },
//       select: { targetVar: true },
//     });
//     return row?.targetVar;
//   } catch (error) {
//     console.error("Error fetching target variable:", error);
//   }
// }

// export async function get_processor_results_by_id(
//   processor_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const rows = await getClient(connection).processorResult.findMany({
//       where: { processorId: processor_id },
//     });
//     return rows.map((row) => ({
//       processor_result: row.processorResult,
//       result_id: row.resultId ?? undefined,
//       processor_id: row.processorId,
//       input_id: row.inputId ?? undefined,
//     })) as ProcessorResult[];
//   } catch (error) {
//     console.error("Error fetching processor results:", error);
//     return [];
//   }
// }

// export async function get_links_by_target(
//   target_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const rows = await getClient(connection).link.findMany({
//       where: { targetNodeId: target_id },
//     });
//     return rows.map((row) => ({
//       source_node_id: row.sourceNodeId,
//       target_node_id: row.targetNodeId,
//       source_var: row.sourceVar,
//       target_var: row.targetVar,
//     })) as Link[];
//   } catch (error) {
//     console.error("Error fetching links by target:", error);
//     return [];
//   }
// }

// export async function get_node_by_id(
//   node_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).node.findUnique({
//       where: { id: node_id },
//     });
//     return row
//       ? ({
//           id: row.id,
//           type: row.type as any,
//           experiment_id: row.experimentId,
//           name: row.name,
//         } as Experiment_node)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching node by ID:", error);
//   }
// }

// export async function get_evaluator_by_id(
//   evaluator_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).evaluator.findUnique({
//       where: { nodeId: evaluator_id },
//     });
//     return row
//       ? {
//           node_id: row.nodeId,
//           type: Eval_type[row.type as keyof typeof Eval_type],
//           code: row.code ?? undefined,
//           name: row.name,
//           return_type: row.returnType as any,
//         }
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching evaluator by ID:", error);
//   }
// }

// export async function get_llm_evaluator_by_id(
//   evaluator_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).llmEvaluator.findUnique({
//       where: { nodeId: evaluator_id },
//     });
//     return row
//       ? ({
//           node_id: row.nodeId,
//           name: row.name,
//           llm_param_id: row.llmParamId,
//           llm_id: row.llmId,
//           format: row.format,
//           prompt: row.prompt,
//           reason_before_scoring: row.reasonBeforeScoring,
//         } as LlmEvaluator)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching llm-evaluator by ID:", error);
//   }
// }

// export async function get_simple_evaluator_by_id(
//   evaluator_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).simpleEvaluator.findUnique({
//       where: { nodeId: evaluator_id },
//       include: { evaluator: true },
//     });
//     return row
//       ? ({
//           node_id: row.nodeId,
//           name: row.evaluator.name,
//           return_type: row.evaluator.returnType as any,
//           text_value: row.textValue,
//           var_value: row.varValue ?? "",
//           var_type: row.varType ?? "",
//           var_selected: row.varSelected ?? false,
//         } as SimpleEvaluator)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching simple-evaluator by ID:", error);
//   }
// }

// export async function get_results_by_processor(
//   processor_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const rows = await getClient(connection).processorResult.findMany({
//       where: { processorId: processor_id },
//     });
//     return rows.map((row) => ({
//       processor_result: row.processorResult,
//       result_id: row.resultId ?? undefined,
//       processor_id: row.processorId,
//       input_id: row.inputId ?? undefined,
//     })) as ProcessorResult[];
//   } catch (error) {
//     console.error("Error fetching processor results:", error);
//     return [];
//   }
// }

// export async function get_result_by_id(
//   result_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).result.findUnique({
//       where: { id: result_id },
//     });
//     return row
//       ? ({
//           id: row.id,
//           run_id: row.runId ?? undefined,
//           config_id: row.configId,
//           output_result: row.outputResult,
//           input_id: row.inputId,
//           start_time: row.startTime,
//           end_time: row.endTime,
//         } as Result)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching result by ID:", error);
//   }
// }

// export async function get_processor_by_id(
//   processor_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).processor.findUnique({
//       where: { nodeId: processor_id },
//     });
//     return row
//       ? ({
//           node_id: row.nodeId,
//           type: Processor_type[row.type as keyof typeof Processor_type],
//           code: row.code ?? undefined,
//           format: row.format ?? undefined,
//           selected_group_vars: row.selectedGroupVars ?? undefined,
//           name: row.name,
//         } as ExperimentProcessor)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching processor by ID:", error);
//   }
// }

// export async function save_error_processor(
//   processor_id: number,
//   error_message: string,
//   result_id: number,
//   input_id: number,
//   resolved_input_id: number | null,
//   timestamp: string,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const result = await getClient(connection).processorError.create({
//       data: {
//         processorId: processor_id,
//         errorMessage: error_message,
//         resultId: result_id ?? null,
//         inputId: input_id ?? null,
//         resolvedInputId: resolved_input_id ?? null,
//         timestamp: new Date(timestamp),
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error("Error saving error processor:", error);
//   }
// }

// export async function save_process_result(
//   processor_result: string,
//   result_id: number | null,
//   processor_id: number,
//   input_id: number | null,
//   resolved_input_id: number | null,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const result = await getClient(connection).processorResult.create({
//       data: {
//         processorResult: processor_result,
//         resultId: result_id,
//         processorId: processor_id,
//         inputId: input_id,
//         resolvedInputId: resolved_input_id,
//       },
//     });
//     return result.id;
//   } catch (error) {
//     console.error("Error saving process result:", error);
//   }
// }
// export async function upsert_experiment_run_snapshot(
//   runState: ExperimentRunState,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const data = {
//       runId: runState.run_id,
//       experimentId: runState.experiment_id,
//       experimentName: runState.experiment_name,
//       status: runState.status as any,
//       createdAt: new Date(runState.created_at),
//       startedAt: runState.started_at ? new Date(runState.started_at) : null,
//       pausedAt: runState.paused_at ? new Date(runState.paused_at) : null,
//       finishedAt: runState.finished_at ? new Date(runState.finished_at) : null,
//       totalPausedMs: BigInt(runState.total_paused_ms ?? 0),
//       totalTasks: runState.total_tasks,
//       attempts: runState.attempts,
//       inProgress: runState.in_progress,
//       completed: runState.completed,
//       failed: runState.failed,
//       retries: runState.retries,
//       totalTokens: BigInt(runState.total_tokens),
//       lastError: runState.last_error ?? null,
//       totalLatencyMs: BigInt(runState.total_latency_ms),
//       latencyCount: runState.latency_count,
//       minLatencyMs: BigInt(runState.min_latency_ms),
//       p25LatencyMs: BigInt(runState.p25_latency_ms),
//       p50LatencyMs: BigInt(runState.p50_latency_ms),
//       p75LatencyMs: BigInt(runState.p75_latency_ms),
//       p95LatencyMs: BigInt(runState.p95_latency_ms),
//       p99LatencyMs: BigInt(runState.p99_latency_ms),
//       maxLatencyMs: BigInt(runState.max_latency_ms),
//       samples: runState.samples as Prisma.InputJsonValue,
//     };
//     await getClient(connection).experimentRun.upsert({
//       where: { runId: runState.run_id },
//       create: data,
//       update: { ...data, createdAt: undefined },
//     });
//   } catch (error) {
//     console.error("Error saving experiment run snapshot:", error);
//   }
// }

// export async function get_processor_result_by_input_id(
//   input_id: number,
//   processor_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).processorResult.findFirst({
//       where: { inputId: input_id, processorId: processor_id },
//     });
//     return row
//       ? ({
//           processor_result: row.processorResult,
//           result_id: row.resultId ?? undefined,
//           processor_id: row.processorId,
//           input_id: row.inputId ?? undefined,
//         } as ProcessorResult)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching processor result by input ID:", error);
//   }
// }

// export async function get_processor_result_by_result_id(
//   result_id: number,
//   processor_id: number,
//   connection: DatabaseClient = prisma,
// ) {
//   try {
//     const row = await getClient(connection).processorResult.findFirst({
//       where: { resultId: result_id, processorId: processor_id },
//     });
//     return row
//       ? ({
//           processor_result: row.processorResult,
//           result_id: row.resultId ?? undefined,
//           processor_id: row.processorId,
//           input_id: row.inputId ?? undefined,
//         } as ProcessorResult)
//       : undefined;
//   } catch (error) {
//     console.error("Error fetching processor result by result ID:", error);
//   }
// }

// export async function get_results_by_experiment_name(
//   experimentName: string,
//   connection: DatabaseClient = prisma,
// ): Promise<Result[]> {
//   const rows = await getClient(connection).result.findMany({
//     where: { config: { experiment: { title: experimentName } } },
//   });
//   return rows.map((row) => ({
//     id: row.id,
//     run_id: row.runId ?? undefined,
//     config_id: row.configId,
//     output_result: row.outputResult,
//     input_id: row.inputId,
//     start_time: row.startTime,
//     end_time: row.endTime,
//   })) as Result[];
// }

// export async function get_results_by_config_id(
//   config_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Result[]> {
//   try {
//     const rows = await getClient(connection).result.findMany({
//       where: { configId: config_id },
//     });
//     return rows.map((row) => ({
//       id: row.id,
//       run_id: row.runId ?? undefined,
//       config_id: row.configId,
//       output_result: row.outputResult,
//       input_id: row.inputId,
//       start_time: row.startTime,
//       end_time: row.endTime,
//     })) as Result[];
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// export async function get_results_by_config_and_input_id(
//   config_id: number,
//   input_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<Result[]> {
//   try {
//     const rows = await getClient(connection).result.findMany({
//       where: { configId: config_id, inputId: input_id },
//     });
//     return rows.map((row) => ({
//       id: row.id,
//       run_id: row.runId ?? undefined,
//       config_id: row.configId,
//       output_result: row.outputResult,
//       input_id: row.inputId,
//       start_time: row.startTime,
//       end_time: row.endTime,
//     })) as Result[];
//   } catch (error) {
//     console.error(error);
//     return [];
//   }
// }

// export async function get_child_evaluator_ids_by_multi_eval_id(
//   multi_evaluator_id: number,
//   connection: DatabaseClient = prisma,
// ): Promise<number[]> {
//   try {
//     const rows = await getClient(connection).multiEvaluator.findMany({
//       where: { evaluatorId: multi_evaluator_id },
//       select: { childEvaluatorId: true },
//     });
//     return rows.map((row) => row.childEvaluatorId);
//   } catch (error) {
//     console.error("Error fetching evaluators by prefix:", error);
//     return [];
//   }
// }
