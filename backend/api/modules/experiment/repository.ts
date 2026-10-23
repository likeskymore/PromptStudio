import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Llm } from "../LLM/types";
import { Experiment } from "./types";

export const ExperimentRepository = {
  async get_experiment_by_name(
    experimentName: string,
    connection: DatabaseClient = prisma,
  ): Promise<Experiment | undefined> {
    const row = await getClient(connection).experiment.findFirst({
      where: { title: experimentName },
    });
    return row
      ? {
          id: row.id,
          title: row.title,
          max_retry: row.maxRetry,
          threads: row.threads,
        }
      : undefined;
  },

  async get_all_experiment_names_and_ids(
    connection: DatabaseClient = prisma,
  ): Promise<Experiment[]> {
    try {
      const rows = await getClient(connection).experiment.findMany({
        select: { id: true, title: true },
      });
      return rows.map((row) => ({ id: row.id, title: row.title }));
    } catch (error) {
      console.error(error);
      return [];
    }
  },
  async get_llm_models_of_experiment(
    experimentId: number,
    connection: DatabaseClient = prisma,
  ): Promise<Llm[]> {
    try {
      const rows = await getClient(connection).llm.findMany({
        where: { promptConfigs: { some: { experimentId } } },
      });
      return rows.map((row) => ({
        id: row.id,
        base_model: row.baseModel,
        name: row.name,
        model: row.model,
      }));
    } catch (error) {
      console.error("Error fetching LLM models for experiment:", error);
      return [];
    }
  },

  async delete_experiment_by_id(
    experimentId: number,
    connection: DatabaseClient = prisma,
  ): Promise<void> {
    try {
      const activeRun = await getClient(connection).experimentRun.findFirst({
        where: { experimentId, status: { in: ["running", "queued"] } },
        select: { runId: true },
      });
      if (activeRun) {
        const error = new Error(
          "Cannot delete an experiment while it is running or queued.",
        );
        error.name = "ExperimentDeletionConflict";
        throw error;
      }
      await getClient(connection).experiment.delete({
        where: { id: experimentId },
      });
    } catch (error) {
      console.error("Error deleting experiment by ID:", error);
      throw error;
    }
  },

  /**
   * Saves an experiment to the database.
   * This function inserts an experiment into the Experiment table.
   * @param experiment The Experiment object containing details of the experiment.
   * @param connection
   * @returns The ID of the newly created experiment.
   */
  async save_experiment(
    experiment: Experiment,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const result = await getClient(connection).experiment.create({
        data: {
          title: experiment.title,
          maxRetry: experiment.max_retry,
          threads: experiment.threads,
        },
      });
      return result.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
