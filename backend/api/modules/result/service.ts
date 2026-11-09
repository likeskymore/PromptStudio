import { DatabaseClient, prisma } from "../../../database/prisma";
import { ResultRepository } from "./repository";
import { Result } from "./types";

export const ResultService = {
  async get_results_by_config_and_input_id(
    config_id: number,
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    return await ResultRepository.get_results_by_config_and_input_id(
      config_id,
      input_id,
      connection,
    );
  },
  async get_results_by_template(
    template_id: string,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    return await ResultRepository.get_results_by_template(
      template_id,
      connection,
    );
  },
  async get_result_by_id(
    result_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result | undefined> {
    return await ResultRepository.get_result_by_id(result_id, connection);
  },
  async get_results_for_run(
    run_id: string,
    config_id: number,
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    return await ResultRepository.get_results_for_run(
      run_id,
      config_id,
      input_id,
      connection,
    );
  },
  async get_results_for_run_and_config(
    run_id: string,
    config_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Result[]> {
    return await ResultRepository.get_results_for_run_and_config(
      run_id,
      config_id,
      connection,
    );
  },
  async handle_save_response(
    run_id: string,
    config_id: number,
    output_result: string,
    input_id: number,
    start_time: string,
    end_time: string,
    total_tokens: number,
    connection: DatabaseClient = prisma,
  ) {
    return await ResultRepository.save_response(
      run_id,
      config_id,
      output_result,
      input_id,
      start_time,
      end_time,
      total_tokens,
      connection,
    );
  },
  async handle_save_error(
    config_id: number,
    error_message: string,
    error_status: number,
    input_id: number,
    start_time: string,
    end_time: string,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    return await ResultRepository.save_error(
      config_id,
      error_message,
      error_status,
      input_id,
      start_time,
      end_time,
      connection,
    );
  },
};
