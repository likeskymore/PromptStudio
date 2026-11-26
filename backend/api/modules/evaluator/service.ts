import path from "path";
import * as fs from "fs";
import { DatabaseClient, prisma } from "../../../database/prisma";
import { Evaluator, MultiEvaluatorMapping } from "./types";
import { EvaluatorRepository } from "./repository";
import { LlmService } from "../LLM/service";
import { EvalProcessRunner } from "../experiment_execution/evalProcessRunner";
import { Experiment } from "../experiment/types";
import { NodeService } from "../node/service";

export const EvaluatorService = {
  /**
   * Handles saving an evaluator node to the database.
   * @param evaluator The evaluator to save.
   * @param connection The database connection to use for saving.
   * @param file_map A map of file fields to their uploaded files.
   * @param experiment_id The ID of the experiment to which the evaluator belongs.
   * @param baseDir The base directory for resolving file paths.
   */
  async handle_save_evaluator(
    evaluator: Evaluator,
    connection: DatabaseClient,
    file_map: Record<string, Express.Multer.File[]>,
    experiment_id: number,
    baseDir?: string,
  ): Promise<number> {
    const node_id = await NodeService.handle_save_node(
      "evaluator",
      experiment_id,
      evaluator.name,
      connection,
    );
    const fileField = `evaluator:${evaluator.file}`;
    const evaluatorFile = evaluator.file;
    if (!evaluatorFile)
      throw new Error(`Evaluator file is required for ${evaluator.name}`);
    const evaluatorPath =
      file_map[fileField]?.[0]?.path ??
      (baseDir ? path.resolve(baseDir, evaluatorFile) : evaluatorFile);
    const evaluatorCode = fs.readFileSync(evaluatorPath, "utf-8");
    await EvaluatorRepository.save_evaluator(
      { ...evaluator, code: evaluatorCode, node_id: node_id },
      connection,
    );
    return node_id;
  },
  /**
   * Handles saving a simple evaluator node to the database.
   * @param evaluator The evaluator to save.
   * @param connection The database connection to use for saving.
   * @param file_map A map of file fields to their uploaded files.
   * @param experiment_id The ID of the experiment to which the evaluator belongs.
   * @param baseDir The base directory for resolving file paths.
   */
  async handle_save_simple_evaluator(
    evaluator: any,
    connection: DatabaseClient,
    file_map: Record<string, Express.Multer.File[]>,
    experiment_id: number,
    baseDir?: string,
  ) {
    const node_id = await this.handle_save_evaluator(
      evaluator,
      connection,
      file_map,
      experiment_id,
      baseDir,
    );
    await EvaluatorRepository.save_simple_evaluator(
      { ...evaluator, node_id: node_id },
      connection,
    );
  },
  /**
   * Handles saving an LLM evaluator node to the database.
   * @param evaluator The evaluator to save.
   * @param connection The database connection to use for saving.
   * @param experiment_id The ID of the experiment to which the evaluator belongs.
   */
  async handle_save_llm_evaluator(
    evaluator: any,
    connection: DatabaseClient,
    experiment_id: number,
  ): Promise<number> {
    const node_id = await NodeService.handle_save_node(
      "evaluator",
      experiment_id,
      evaluator.name,
      connection,
    );
    const existing = await LlmService.get_llm_by_base_model(
      evaluator.grader.base_model,
      connection,
    );
    const llm_id = existing
      ? existing.id
      : await LlmService.handle_save_llm(evaluator.grader, connection);
    const llm_params = LlmService.build_LLM_Params(evaluator.grader);
    const llm_param_id = await LlmService.handle_save_llm_param(
      llm_params,
      connection,
    );
    await EvaluatorRepository.save_evaluator(
      { ...evaluator, node_id: node_id },
      connection,
    );
    await EvaluatorRepository.save_llm_evaluator(
      {
        ...evaluator,
        node_id: node_id,
        llm_param_id: llm_param_id,
        llm_id: llm_id,
      },
      connection,
    );

    return node_id;
  },
  /**
   * Handles saving a multi evaluator node and its child nodes mapping to the database.
   * @param evaluator The evaluator to save.
   * @param connection The database connection to use for saving.
   * @param file_map A map of file fields to their uploaded files.
   * @param experiment_id The ID of the experiment to which the evaluator belongs.
   * @param baseDir The base directory for resolving file paths.
   */
  async handle_save_multi_evaluator(
    evaluator: any,
    connection: DatabaseClient,
    file_map: Record<string, Express.Multer.File[]>,
    experiment_id: number,
    baseDir?: string,
  ) {
    const node_id = await NodeService.handle_save_node(
      "evaluator",
      experiment_id,
      evaluator.name,
      connection,
    );
    await EvaluatorRepository.save_evaluator(
      { ...evaluator, node_id: node_id },
      connection,
    );

    const mappings: MultiEvaluatorMapping[] = [];

    if (
      evaluator.evaluators.length > 0 &&
      Array.isArray(evaluator.evaluators)
    ) {
      for (const childEvaluatorNode of evaluator.evaluators) {
        const childEvaluator = childEvaluatorNode.evaluator;
        let childEvalNodeId: number;
        if (String(childEvaluator.type).toLowerCase() === "llm") {
          childEvalNodeId = await this.handle_save_llm_evaluator(
            childEvaluator,
            connection,
            experiment_id,
          );
        } else {
          childEvalNodeId = await this.handle_save_evaluator(
            childEvaluator,
            connection,
            file_map,
            experiment_id,
            baseDir,
          );
        }
        mappings.push([node_id, childEvalNodeId]);
      }
    }

    if (mappings.length > 0) {
      await EvaluatorRepository.save_multi_evaluator_mapping(
        mappings,
        connection,
      );
    }
  },
  /**
   * Runs an evaluator for a given experiment creating a new EvaluatorRunner instance.
   * @param evaluator_id The ID of the evaluator node to run.
   * @param experiment The experiment object containing details like title and threads.
   */
  async run_evaluator(evaluator_id: number, experiment: Experiment) {
    try {
      const num_workers = experiment.threads || 1;
      const runner = new EvalProcessRunner(
        experiment.title,
        num_workers,
        evaluator_id,
      );
      await runner.evaluate();
    } catch (error) {
      console.error(`Error running evaluator ${evaluator_id}:`, error);
    }
  },
  async get_evaluation_result(result_id: number, evaluator_id: number) {
    return await EvaluatorRepository.get_evaluation_result(
      result_id,
      evaluator_id,
    );
  },
  async get_evaluator_by_id(evaluator_id: number) {
    return await EvaluatorRepository.get_evaluator_by_id(evaluator_id);
  },
  async get_child_evaluator_ids_by_multi_eval_id(
    multi_evaluator_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<number[]> {
    return await EvaluatorRepository.get_child_evaluator_ids_by_multi_eval_id(
      multi_evaluator_id,
      connection,
    );
  },
  async get_llm_evaluator_by_id(
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await EvaluatorRepository.get_llm_evaluator_by_id(
      evaluator_id,
      connection,
    );
  },
  async handle_save_error_evaluator(
    evaluator_id: number,
    error_message: string,
    result_id: number,
    input_id: number,
    timestamp: string,
    connection: DatabaseClient = prisma,
  ) {
    return await EvaluatorRepository.save_error_evaluator(
      evaluator_id,
      error_message,
      result_id,
      input_id,
      timestamp,
      connection,
    );
  },
  async handle_save_eval_result(
    eval_result: unknown,
    result_id: number,
    input_id: number,
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await EvaluatorRepository.save_eval_result(
      eval_result,
      result_id,
      input_id,
      evaluator_id,
      connection,
    );
  },
  async get_simple_evaluator_by_id(
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await EvaluatorRepository.get_simple_evaluator_by_id(
      evaluator_id,
      connection,
    );
  },
};
