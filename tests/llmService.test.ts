import { LlmRepository } from "../backend/api/modules/LLM/repository";
import { LlmService } from "../backend/api/modules/LLM/service";

jest.mock("../backend/api/modules/LLM/repository", () => ({
  LlmRepository: {
    get_llm_by_base_model: jest.fn(),
    save_llm: jest.fn(),
    save_llm_param: jest.fn(),
    get_llm_by_id: jest.fn(),
    get_llm_param_by_id: jest.fn(),
  },
}));
jest.mock("../backend/api/ChainForgeUtils/utils", () => ({
  set_api_keys: jest.fn(),
  extract_llm_provider: jest.fn(),
  deepcopy: (value: any) => JSON.parse(JSON.stringify(value)),
  to_standard_format: jest.fn(),
}));
jest.mock("../backend/api/ChainForgeUtils/query", () => ({
  PromptPipeline: jest.fn(),
}));
jest.mock("../backend/api/modules/LLM/models", () => ({
  LLM: {},
}));

describe("LlmService", () => {
  it("builds LLM parameters", () => {
    expect(
      LlmService.build_LLM_Params({
        name: "GPT-4",
        base_model: "gpt-4",
        model: "gpt-4",
        temp: 0.4,
        formData: { enabled: true },
      }),
    ).toEqual({
      temperature: 0.4,
      custom_params: { formData: '{"enabled":true}' },
    });
  });

  it("delegates LLM lookup", async () => {
    const llm = { id: 7, base_model: "gpt-4" };
    jest
      .mocked(LlmRepository.get_llm_by_base_model)
      .mockResolvedValue(llm as never);

    await expect(LlmService.get_llm_by_base_model("gpt-4")).resolves.toEqual(
      llm,
    );
  });

  it("saves an LLM through the repository", async () => {
    jest.mocked(LlmRepository.save_llm).mockResolvedValue(7);
    const llm = {
      name: "GPT-4",
      base_model: "gpt-4",
      model: "gpt-4",
      temp: 0.4,
    };

    await expect(LlmService.handle_save_llm(llm)).resolves.toBe(7);
  });

  it("propagates LLM save failures", async () => {
    jest
      .mocked(LlmRepository.save_llm)
      .mockRejectedValue(new Error("llm save failed"));

    await expect(
      LlmService.handle_save_llm({
        name: "GPT-4",
        base_model: "gpt-4",
        model: "gpt-4",
        temp: 0.4,
      }),
    ).rejects.toThrow("llm save failed");
  });

  it("gets LLM parameters from the repository", async () => {
    jest.mocked(LlmRepository.get_llm_param_by_id).mockResolvedValue({
      temperature: 0.4,
    } as never);

    await expect(LlmService.get_llm_param_by_id(3)).resolves.toEqual({
      temperature: 0.4,
    });
  });

  it("rejects invalid queries", async () => {
    await expect(
      LlmService.queryLLM("", "gpt-4", 1, "Hello", {}),
    ).rejects.toThrow("id is improper format");
  });
});
