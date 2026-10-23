import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Eval_type, Evaluator, LlmEvaluator, SimpleEvaluator } from "./types";

export const EvaluatorRepository = {
  async save_evaluator(
    evaluator: Evaluator,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      await getClient(connection).evaluator.create({
        data: {
          nodeId: evaluator.node_id,
          type: evaluator.type as any,
          code: evaluator.code ?? null,
          name: evaluator.name,
          returnType: evaluator.return_type as any,
        },
      });
      return evaluator.node_id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async save_simple_evaluator(
    evaluator: SimpleEvaluator,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      await getClient(connection).simpleEvaluator.create({
        data: {
          nodeId: evaluator.node_id,
          textValue: evaluator.text_value,
          varValue: evaluator.var_value,
          varType: evaluator.var_type,
          varSelected: evaluator.var_selected,
        },
      });
      return evaluator.node_id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async save_llm_evaluator(
    evaluator: LlmEvaluator,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      await getClient(connection).llmEvaluator.create({
        data: {
          nodeId: evaluator.node_id,
          name: evaluator.name,
          llmParamId: evaluator.llm_param_id,
          llmId: evaluator.llm_id,
          format: evaluator.format,
          prompt: evaluator.prompt,
          reasonBeforeScoring: evaluator.reason_before_scoring,
        },
      });
      return evaluator.node_id;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async save_multi_evaluator_mapping(
    mappings: [number, number][],
    connection: DatabaseClient = prisma,
  ): Promise<void> {
    await getClient(connection).multiEvaluator.createMany({
      data: mappings.map(([evaluatorId, childEvaluatorId]) => ({
        evaluatorId,
        childEvaluatorId,
      })),
    });
  },
  async get_evaluator_by_id(
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).evaluator.findUnique({
        where: { nodeId: evaluator_id },
      });
      return row
        ? {
            node_id: row.nodeId,
            type: Eval_type[row.type as keyof typeof Eval_type],
            code: row.code ?? undefined,
            name: row.name,
            return_type: row.returnType as any,
          }
        : undefined;
    } catch (error) {
      console.error("Error fetching evaluator by ID:", error);
    }
  },
  async get_llm_evaluator_by_id(
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).llmEvaluator.findUnique({
        where: { nodeId: evaluator_id },
      });
      return row
        ? ({
            node_id: row.nodeId,
            name: row.name,
            llm_param_id: row.llmParamId,
            llm_id: row.llmId,
            format: row.format,
            prompt: row.prompt,
            reason_before_scoring: row.reasonBeforeScoring,
          } as LlmEvaluator)
        : undefined;
    } catch (error) {
      console.error("Error fetching llm-evaluator by ID:", error);
    }
  },

  async get_simple_evaluator_by_id(
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).simpleEvaluator.findUnique({
        where: { nodeId: evaluator_id },
        include: { evaluator: true },
      });
      return row
        ? ({
            node_id: row.nodeId,
            name: row.evaluator.name,
            return_type: row.evaluator.returnType as any,
            text_value: row.textValue,
            var_value: row.varValue ?? "",
            var_type: row.varType ?? "",
            var_selected: row.varSelected ?? false,
          } as SimpleEvaluator)
        : undefined;
    } catch (error) {
      console.error("Error fetching simple-evaluator by ID:", error);
    }
  },
  async get_child_evaluator_ids_by_multi_eval_id(
    multi_evaluator_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<number[]> {
    try {
      const rows = await getClient(connection).multiEvaluator.findMany({
        where: { evaluatorId: multi_evaluator_id },
        select: { childEvaluatorId: true },
      });
      return rows.map((row) => row.childEvaluatorId);
    } catch (error) {
      console.error("Error fetching evaluators by prefix:", error);
      return [];
    }
  },
  async save_eval_result(
    eval_result: unknown,
    result_id: number,
    input_id: number,
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const result = await getClient(connection).evaluationsResult.create({
        data: {
          evaluationResult: String(eval_result),
          resultId: result_id ?? null,
          inputId: input_id ?? null,
          evaluatorId: evaluator_id,
        },
      });
      return result.id;
    } catch (error) {
      console.error("Error saving evaluation result:", error);
    }
  },
  async get_evaluation_result(
    result_id: number,
    evaluator_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<string | undefined> {
    try {
      const row = await getClient(connection).evaluationsResult.findFirst({
        where: { resultId: result_id, evaluatorId: evaluator_id },
        select: { evaluationResult: true },
      });
      return row?.evaluationResult;
    } catch (error) {
      console.error("Error fetching evaluation result:", error);
    }
  },
  async save_error_evaluator(
    evaluator_id: number,
    error_message: string,
    result_id: number,
    input_id: number,
    timestamp: string,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const result = await getClient(connection).errorEvaluator.create({
        data: {
          evaluatorId: evaluator_id,
          errorMessage: error_message,
          resultId: result_id ?? null,
          inputId: input_id ?? null,
          timestamp: new Date(timestamp),
        },
      });
      return result.id;
    } catch (error) {
      console.error("Error saving error evaluator:", error);
    }
  },
};
