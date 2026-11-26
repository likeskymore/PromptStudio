import { EvaluatorRepository } from "../backend/api/modules/evaluator/repository";
import { EvaluatorService } from "../backend/api/modules/evaluator/service";

jest.mock("../backend/api/modules/evaluator/repository", () => ({
  EvaluatorRepository: {
    get_evaluator_by_id: jest.fn(),
    save_evaluator: jest.fn(),
    save_eval_result: jest.fn(),
  },
}));
jest.mock(
  "../backend/api/modules/experiment_execution/evalProcessRunner",
  () => ({
    EvalProcessRunner: jest.fn(),
  }),
);
jest.mock("../backend/api/modules/LLM/service", () => ({
  LlmService: {},
}));
jest.mock("../backend/api/modules/node/service", () => ({
  NodeService: { handle_save_node: jest.fn() },
}));

describe("EvaluatorService", () => {
  it("gets an evaluator through the repository", async () => {
    jest.mocked(EvaluatorRepository.get_evaluator_by_id).mockResolvedValue({
      node_id: 8,
      name: "Score",
    } as never);

    await expect(EvaluatorService.get_evaluator_by_id(8)).resolves.toEqual(
      expect.objectContaining({ node_id: 8 }),
    );
  });

  it("returns undefined when evaluator lookup fails", async () => {
    jest
      .mocked(EvaluatorRepository.get_evaluator_by_id)
      .mockResolvedValue(undefined);

    await expect(
      EvaluatorService.get_evaluator_by_id(404),
    ).resolves.toBeUndefined();
  });

  it("saves an evaluation result", async () => {
    jest.mocked(EvaluatorRepository.save_eval_result).mockResolvedValue(21);

    await expect(
      EvaluatorService.handle_save_eval_result({ score: 1 }, 42, 3, 8),
    ).resolves.toBe(21);
  });

  it("propagates evaluation result save failures", async () => {
    jest
      .mocked(EvaluatorRepository.save_eval_result)
      .mockRejectedValue(new Error("evaluation save failed"));

    await expect(
      EvaluatorService.handle_save_eval_result({ score: 1 }, 42, 3, 8),
    ).rejects.toThrow("evaluation save failed");
  });
});
