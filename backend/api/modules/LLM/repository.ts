import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Llm, Llm_params, LLMSpec } from "./types";

export const LlmRepository = {
  /**
   * Saves a new LLM specification to the database.
   * @param llm The LLMSpec object containing details of the LLM.
   * @param connection
   * @returns The ID of the newly created LLM.
   */
  async save_llm(
    llm: LLMSpec,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      // Check if the LLM already exists
      const existingLlm = await this.get_llm_by_base_model(
        llm.base_model,
        connection,
      );
      if (existingLlm) {
        // If it exists, return its ID
        return existingLlm.id;
      }
      const result = await getClient(connection).llm.create({
        data: { baseModel: llm.base_model, name: llm.name, model: llm.model },
      });
      return result.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  /**
   * Saves LLM parameters to the database.
   * This function inserts the parameters into the llm_param table and saves any custom parameters in llm_custom_param.
   * @param llm_params The Llm_params object containing the parameters to be saved.
   * @param connection
   * @returns The ID of the newly created LLM parameters.
   */
  async save_llm_param(
    llm_params: Partial<Llm_params>,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const data = {
        temperature: llm_params.temperature,
        maxTokens: llm_params.max_tokens,
        topP: llm_params.top_p,
        topK: llm_params.top_k,
        stopSequence: llm_params.stop_sequence,
        frequencyPenalty: llm_params.frequency_penalty,
        presencePenalty: llm_params.presence_penalty,
      };
      if (Object.values(data).every((value) => value === undefined)) {
        throw new Error("No valid parameters provided");
      }
      const result = await getClient(connection).llmParam.create({ data });

      // Save custom parameters if provided
      if (llm_params.custom_params !== undefined) {
        await getClient(connection).llmCustomParam.createMany({
          data: Object.entries(llm_params.custom_params).map(
            ([name, value]) => ({
              name,
              value: String(value),
              llmParamId: result.id,
            }),
          ),
        });
      }

      return result.id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  /**
   * Retrieves an LLM specification by its ID.
   * This function fetches the LLM details from the database using the provided LLM ID.
   * @param llm_id The ID of the LLM to retrieve.
   * @param connection
   * @return The LLMSpec object if found, otherwise undefined.
   */
  async get_llm_by_id(
    llm_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<LLMSpec | undefined> {
    try {
      const row = await getClient(connection).llm.findUnique({
        where: { id: llm_id },
      });
      return row
        ? {
            name: row.name,
            base_model: row.baseModel,
            model: row.model,
            temp: 0,
          }
        : undefined;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  /**
   * Retrieves LLM parameters by their ID.
   * This function fetches the LLM parameters from the database using the provided LLM parameter ID.
   * It also retrieves any custom parameters associated with the LLM parameter.
   * @param llm_param_id The ID of the LLM parameter to retrieve.
   * @param connection
   * @return The Llm_params object if found, otherwise undefined.
   */
  async get_llm_param_by_id(
    llm_param_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Llm_params> {
    try {
      const row = await getClient(connection).llmParam.findUnique({
        where: { id: llm_param_id },
        include: { customParams: true },
      });
      if (!row) return undefined as unknown as Llm_params;
      return {
        id: row.id,
        temperature: row.temperature ?? undefined,
        max_tokens: row.maxTokens ?? undefined,
        top_p: row.topP ?? undefined,
        top_k: row.topK ?? undefined,
        stop_sequence: row.stopSequence ?? undefined,
        frequency_penalty: row.frequencyPenalty ?? undefined,
        presence_penalty: row.presencePenalty ?? undefined,
        custom_params: Object.fromEntries(
          row.customParams.map((param) => [param.name, param.value]),
        ),
      };
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async get_llm_by_base_model(
    base_model: string,
    connection: DatabaseClient = prisma,
  ): Promise<Llm | undefined> {
    try {
      const result = await getClient(connection).llm.findUnique({
        where: { baseModel: base_model },
      });
      return result
        ? {
            id: result.id,
            base_model: result.baseModel,
            name: result.name,
            model: result.model,
          }
        : undefined;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
};
