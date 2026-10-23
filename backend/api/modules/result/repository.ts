import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Result } from "./types";

export const ResultRepository = {
  async save_response(
    run_id: string,
    config_id: number,
    output_result: string,
    input_id: number,
    start_time: string,
    end_time: string,
    total_tokens: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const result = await getClient(connection).result.create({
        data: {
          runId: run_id,
          configId: config_id,
          outputResult: output_result,
          inputId: input_id,
          startTime: new Date(start_time),
          endTime: new Date(end_time),
          totalTokens: total_tokens,
        },
      });
      return result.id;
    } catch (error) {
      console.error(error);
    }
  },
  async save_error(
    config_id: number,
    error_message: string,
    error_status: number,
    input_id: number,
    start_time: string,
    end_time: string,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const result = await getClient(connection).error.create({
        data: {
          configId: config_id,
          errorMessage: error_message,
          errorCode: error_status,
          inputId: input_id,
          startTime: new Date(start_time),
          endTime: new Date(end_time),
        },
      });
      return result.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async get_results_for_run(
    run_id: string,
    config_id: number,
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    try {
      const rows = await getClient(connection).result.findMany({
        where: { runId: run_id, configId: config_id, inputId: input_id },
      });
      return rows.map((row) => ({
        id: row.id,
        run_id: row.runId ?? undefined,
        config_id: row.configId,
        output_result: row.outputResult,
        input_id: row.inputId,
        start_time: row.startTime,
        end_time: row.endTime,
      })) as Result[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },
  async get_results_by_template(
    template_id: string,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    try {
      const rows = await getClient(connection).result.findMany({
        where: { config: { promptTemplateId: Number(template_id) } },
      });
      return rows.map((row) => ({
        id: row.id,
        run_id: row.runId ?? undefined,
        config_id: row.configId,
        output_result: row.outputResult,
        input_id: row.inputId,
        start_time: row.startTime,
        end_time: row.endTime,
      })) as Result[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },
  async get_result_by_id(
    result_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).result.findUnique({
        where: { id: result_id },
      });
      return row
        ? ({
            id: row.id,
            run_id: row.runId ?? undefined,
            config_id: row.configId,
            output_result: row.outputResult,
            input_id: row.inputId,
            start_time: row.startTime,
            end_time: row.endTime,
          } as Result)
        : undefined;
    } catch (error) {
      console.error("Error fetching result by ID:", error);
    }
  },
  async get_results_by_experiment_name(
    experimentName: string,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    const rows = await getClient(connection).result.findMany({
      where: { config: { experiment: { title: experimentName } } },
    });
    return rows.map((row) => ({
      id: row.id,
      run_id: row.runId ?? undefined,
      config_id: row.configId,
      output_result: row.outputResult,
      input_id: row.inputId,
      start_time: row.startTime,
      end_time: row.endTime,
    })) as Result[];
  },

  async get_results_by_config_id(
    config_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    try {
      const rows = await getClient(connection).result.findMany({
        where: { configId: config_id },
      });
      return rows.map((row) => ({
        id: row.id,
        run_id: row.runId ?? undefined,
        config_id: row.configId,
        output_result: row.outputResult,
        input_id: row.inputId,
        start_time: row.startTime,
        end_time: row.endTime,
      })) as Result[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  async get_results_by_config_and_input_id(
    config_id: number,
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    try {
      const rows = await getClient(connection).result.findMany({
        where: { configId: config_id, inputId: input_id },
      });
      return rows.map((row) => ({
        id: row.id,
        run_id: row.runId ?? undefined,
        config_id: row.configId,
        output_result: row.outputResult,
        input_id: row.inputId,
        start_time: row.startTime,
        end_time: row.endTime,
      })) as Result[];
    } catch (error) {
      console.error(error);
      return [];
    }
  },
};
