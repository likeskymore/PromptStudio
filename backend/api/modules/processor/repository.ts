import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { ExperimentProcessor, Processor_type, ProcessorResult } from "./types";

export const ProcessorRepository = {
  async save_processor(
    processor: ExperimentProcessor,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      await getClient(connection).processor.create({
        data: {
          nodeId: processor.node_id,
          type: processor.type as any,
          code: processor.code ?? null,
          format: processor.format ?? null,
          selectedGroupVars: processor.selected_group_vars ?? null,
          name: processor.name,
        },
      });
      return processor.node_id;
    } catch (error) {
      throw error;
    }
  },
  async get_processor_results_by_processor_id(
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const rows = await getClient(connection).processorResult.findMany({
        where: { processorId: processor_id },
      });
      return rows.map((row) => ({
        processor_result: row.processorResult,
        result_id: row.resultId ?? undefined,
        processor_id: row.processorId,
        input_id: row.inputId ?? undefined,
      })) as ProcessorResult[];
    } catch (error) {
      console.error("Error fetching processor results:", error);
      return [];
    }
  },
  async get_processor_by_id(
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).processor.findUnique({
        where: { nodeId: processor_id },
      });
      return row
        ? ({
            node_id: row.nodeId,
            type: Processor_type[row.type as keyof typeof Processor_type],
            code: row.code ?? undefined,
            format: row.format ?? undefined,
            selected_group_vars: row.selectedGroupVars ?? undefined,
            name: row.name,
          } as ExperimentProcessor)
        : undefined;
    } catch (error) {
      console.error("Error fetching processor by ID:", error);
    }
  },
  async save_error_processor(
    processor_id: number,
    error_message: string,
    result_id: number,
    input_id: number,
    resolved_input_id: number | null,
    timestamp: string,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const result = await getClient(connection).processorError.create({
        data: {
          processorId: processor_id,
          errorMessage: error_message,
          resultId: result_id ?? null,
          inputId: input_id ?? null,
          resolvedInputId: resolved_input_id ?? null,
          timestamp: new Date(timestamp),
        },
      });
      return result.id;
    } catch (error) {
      console.error("Error saving error processor:", error);
    }
  },
  async save_process_result(
    processor_result: string,
    result_id: number | null,
    processor_id: number,
    input_id: number | null,
    resolved_input_id: number | null,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const result = await getClient(connection).processorResult.create({
        data: {
          processorResult: processor_result,
          resultId: result_id,
          processorId: processor_id,
          inputId: input_id,
          resolvedInputId: resolved_input_id,
        },
      });
      return result.id;
    } catch (error) {
      console.error("Error saving process result:", error);
    }
  },
  async get_processor_result_by_input_id(
    input_id: number,
    processor_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).processorResult.findFirst({
        where: { inputId: input_id, processorId: processor_id },
      });
      return row
        ? ({
            processor_result: row.processorResult,
            result_id: row.resultId ?? undefined,
            processor_id: row.processorId,
            input_id: row.inputId ?? undefined,
          } as ProcessorResult)
        : undefined;
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
      const row = await getClient(connection).processorResult.findFirst({
        where: { resultId: result_id, processorId: processor_id },
      });
      return row
        ? ({
            processor_result: row.processorResult,
            result_id: row.resultId ?? undefined,
            processor_id: row.processorId,
            input_id: row.inputId ?? undefined,
          } as ProcessorResult)
        : undefined;
    } catch (error) {
      console.error("Error fetching processor result by result ID:", error);
    }
  },
};
