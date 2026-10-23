import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Promptconfig } from "../experiment_config/types";
import { PromptTemplate } from "./types";

export const PromptRepository = {
  /**
   * Saves a prompt template to the database.
   * This function inserts a template into the PromptTemplate table and associates any sub-templates with it.
   * @param template The prompt template string to be saved.
   * @param name The name of the template.
   * @param iterations The number of iterations for the template.
   * @param node_id The ID of the node associated with this template.
   * @param connection
   * @return The ID of the newly created template.
   */
  async save_template(
    template: string,
    name: string,
    iterations: number,
    node_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      await getClient(connection).promptTemplate.create({
        data: { nodeId: node_id, value: template, name, iterations },
      });
      return node_id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  /**
   * Saves a prompt configuration to the database.
   * This function inserts a new prompt configuration into the promptconfig table.
   * @param experiment_id The ID of the experiment associated with this configuration.
   * @param llm_id The ID of the LLM used in this configuration.
   * @param llm_param_id The ID of the LLM parameters used in this configuration.
   * @param template_id The ID of the prompt template used in this configuration.
   * @param dataset_id The ID of the dataset used in this configuration.
   * @param connection
   * @returns The ID of the newly created prompt configuration.
   */
  async save_promptconfig(
    experiment_id: number,
    llm_id: number,
    llm_param_id: number,
    template_id: number,
    dataset_id: number | null,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const result = await getClient(connection).promptConfig.create({
        data: {
          experimentId: experiment_id,
          llmId: llm_id,
          llmParamId: llm_param_id,
          promptTemplateId: template_id,
          finalDatasetId: dataset_id,
        },
      });
      return result.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  /**
   * Retrieves all prompt configurations associated with a specific experiment.
   * @param experiment_id The ID of the experiment for which to retrieve prompt configurations.
   * @param connection
   * @returns An array of Promptconfig objects associated with the specified experiment.
   */
  async get_prompt_config_by_experiment(
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Promptconfig[]> {
    try {
      const rows = await getClient(connection).promptConfig.findMany({
        where: { experimentId: experiment_id },
      });
      return rows.map((row) => ({
        id: row.id,
        experiment_id: row.experimentId,
        LLM_id: row.llmId,
        LLM_param_id: row.llmParamId,
        prompt_template_id: row.promptTemplateId,
        final_dataset_id: row.finalDatasetId as number,
        datasets: [],
      }));
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  /**
   * Retrieves a prompt template by its ID.
   * @param template_id The ID of the prompt template to retrieve.
   * @param connection
   * @return The prompttemplate object if found, otherwise undefined.
   */
  async get_prompt_template_by_id(
    template_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<PromptTemplate | undefined> {
    try {
      const row = await getClient(connection).promptTemplate.findUnique({
        where: { nodeId: template_id },
      });
      return row
        ? {
            node_id: row.nodeId,
            value: row.value,
            name: row.name,
            iterations: row.iterations,
            llms: [],
          }
        : undefined;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
