import { PromptService } from "../backend/api/modules/prompt/service";
import { PromptRepository } from "../backend/api/modules/prompt/repository";

jest.mock("../backend/api/modules/prompt/repository", () => ({
  PromptRepository: {
    get_prompt_config_by_experiment: jest.fn(),
    get_prompt_template_by_id: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_execution/promptRunner", () => ({
  PromptRunner: jest.fn(),
}));
jest.mock("../backend/api/modules/LLM/service", () => ({
  LlmService: {},
}));
jest.mock("../backend/api/modules/experiment_config/service", () => ({
  ExperimentConfigService: {},
}));
jest.mock("../backend/api/modules/node/service", () => ({
  NodeService: { handle_save_node: jest.fn() },
}));

describe("PromptService.fillTemplate", () => {
  it("resolves nested template markers", () => {
    expect(
      PromptService.fillTemplate("Hello {name}, {greeting}!", {
        name: "Ada",
        greeting: "welcome to {place}",
        place: "PromptStudio",
      }),
    ).toBe("Hello Ada, welcome to PromptStudio!");
  });

  it("preserves unresolved markers", () => {
    expect(
      PromptService.fillTemplate("{known} {missing}", { known: "value" }),
    ).toBe("value {missing}");
  });

  it("does not replace markers with nullish values", () => {
    expect(
      PromptService.fillTemplate("Value: {value}", {
        value: undefined,
      } as unknown as Record<string, string>),
    ).toBe("Value: {value}");
  });
});

describe("PromptService database methods", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("gets prompt templates through the repository", async () => {
    jest.mocked(PromptRepository.get_prompt_template_by_id).mockResolvedValue({
      node_id: 10,
      value: "Hello {name}",
      name: "Greeting",
      iterations: 1,
      llms: [],
    });

    await expect(PromptService.get_prompt_template_by_id(10)).resolves.toEqual(
      expect.objectContaining({ node_id: 10, name: "Greeting" }),
    );
  });

  it("propagates prompt template get failures", async () => {
    jest
      .mocked(PromptRepository.get_prompt_template_by_id)
      .mockRejectedValue(new Error("prompt get failed"));

    await expect(PromptService.get_prompt_template_by_id(10)).rejects.toThrow(
      "prompt get failed",
    );
  });

  it("gets prompt configs through the repository", async () => {
    jest
      .mocked(PromptRepository.get_prompt_config_by_experiment)
      .mockResolvedValue([]);

    await expect(
      PromptService.get_prompt_config_by_experiment(5),
    ).resolves.toEqual([]);
  });
});
