import path from "path";
import * as fs from "fs";
import { DatabaseClient, prisma } from "../../../database/prisma";
import { ProcessorRepository } from "./repository";
import { Experiment } from "../experiment/types";
import { EvalProcessRunner } from "../experiment_execution/evalProcessRunner";
import { NodeService } from "../node/service";

export const ProcessorService = {
  /**
   * Handles saving a processor node to the database.
   * @param processor The processor to save.
   * @param connection The database connection to use for saving.
   * @param file_map A map of file fields to their uploaded files.
   * @param experiment_id The ID of the experiment to which the processor belongs.
   */
  async handle_save_processor(
    processor: any,
    connection: DatabaseClient,
    file_map: Record<string, Express.Multer.File[]>,
    experiment_id: number,
    baseDir?: string,
  ) {
    const node_id = await NodeService.handle_save_node(
      "processor",
      experiment_id,
      processor.name,
      connection,
    );
    if (processor.type === "split" || processor.type === "join") {
      await ProcessorRepository.save_processor(
        { ...processor, node_id: node_id },
        connection,
      );
      return;
    }
    const fileField = `processor:${processor.file}`;
    const processorPath =
      file_map[fileField]?.[0]?.path ??
      (baseDir ? path.resolve(baseDir, processor.file) : processor.file);
    const processorCode = fs.readFileSync(processorPath, "utf-8");
    await ProcessorRepository.save_processor(
      { ...processor, code: processorCode, node_id: node_id },
      connection,
    );
  },
  /**
   * Runs a processor for a given experiment creating a new EvaluatorRunner instance.
   * This function is similar to run_evaluator but is used for processing data rather than evaluating it
   * @param processor_id The ID of the processor node to run.
   * @param experiment The experiment object containing details like title and threads.
   */
  async run_processor(processor_id: number, experiment: Experiment) {
    try {
      const num_workers = experiment.threads || 1;
      const runner = new EvalProcessRunner(
        experiment.title,
        num_workers,
        processor_id,
      );
      await runner.process();
    } catch (error) {
      console.error(`Error running processor ${processor_id}:`, error);
    }
  },
  async get_processor_results_by_processor_id(
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await ProcessorRepository.get_processor_results_by_processor_id(
      processor_id,
      connection,
    );
  },
  async get_processor_by_id(
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await ProcessorRepository.get_processor_by_id(
        processor_id,
        connection,
      );
      return row;
    } catch (error) {
      console.error("Error fetching processor by ID:", error);
    }
  },
  async get_processor_result_by_input_id(
    input_id: number,
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await ProcessorRepository.get_processor_result_by_input_id(
        input_id,
        processor_id,
        connection,
      );
      return row;
    } catch (error) {
      console.error("Error fetching processor result by input ID:", error);
    }
  },
  async get_processor_result_by_result_id(
    result_id: number,
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await ProcessorRepository.get_processor_result_by_result_id(
        result_id,
        processor_id,
        connection,
      );
      return row;
    } catch (error) {
      console.error("Error fetching processor result by result ID:", error);
    }
  },
  async handle_save_process_result(
    processor_result: string,
    result_id: number | null,
    processor_id: number,
    input_id: number | null,
    resolved_input_id: number | null,
    connection: DatabaseClient = prisma,
  ) {
    return await ProcessorRepository.save_process_result(
      processor_result,
      result_id,
      processor_id,
      input_id,
      resolved_input_id,
      connection,
    );
  },
  async handle_save_error_processor(
    processor_id: number,
    error_message: string,
    result_id: number,
    input_id: number,
    resolved_input_id: number | null,
    timestamp: string,
    connection: DatabaseClient = prisma,
  ) {
    return await ProcessorRepository.save_error_processor(
      processor_id,
      error_message,
      result_id,
      input_id,
      resolved_input_id,
      timestamp,
      connection,
    );
  },
};
