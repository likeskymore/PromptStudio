import { ExperimentConfigRepository } from "../backend/api/modules/experiment_config/repository";
import { ExperimentConfigService } from "../backend/api/modules/experiment_config/service";

jest.mock("../backend/api/modules/experiment_config/repository", () => ({
  ExperimentConfigRepository: {
    get_last_input_id: jest.fn(),
    get_next_input: jest.fn(),
    save_resolved_input: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/evaluator/service", () => ({
  EvaluatorService: {},
}));
jest.mock("../backend/api/modules/processor/service", () => ({
  ProcessorService: {},
}));
jest.mock("../backend/api/modules/prompt/service", () => ({
  PromptService: {},
}));
jest.mock("../backend/api/modules/node/service", () => ({
  NodeService: {},
}));
jest.mock("../backend/api/modules/experiment/service", () => ({
  ExperimentService: {},
}));
jest.mock("../backend/api/modules/result/service", () => ({
  ResultService: {},
}));

describe("ExperimentConfigService", () => {
  it("gets the last input id", async () => {
    jest
      .mocked(ExperimentConfigRepository.get_last_input_id)
      .mockResolvedValue(12);

    await expect(ExperimentConfigService.get_last_input_id(4)).resolves.toBe(
      12,
    );
  });

  it("propagates configuration get failures", async () => {
    jest
      .mocked(ExperimentConfigRepository.get_last_input_id)
      .mockRejectedValue(new Error("config lookup failed"));

    await expect(ExperimentConfigService.get_last_input_id(4)).rejects.toThrow(
      "config lookup failed",
    );
  });

  it("saves a resolved input", async () => {
    jest
      .mocked(ExperimentConfigRepository.save_resolved_input)
      .mockResolvedValue(31);

    await expect(
      ExperimentConfigService.handle_save_resolved_input(3, "Ada"),
    ).resolves.toBe(31);
  });

  it("propagates resolved input save failures", async () => {
    jest
      .mocked(ExperimentConfigRepository.save_resolved_input)
      .mockRejectedValue(new Error("resolved input save failed"));

    await expect(
      ExperimentConfigService.handle_save_resolved_input(3, "Ada"),
    ).rejects.toThrow("resolved input save failed");
  });
});
