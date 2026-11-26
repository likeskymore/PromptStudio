import * as workerpool from "workerpool";
import { PromptRunner } from "../backend/api/modules/experiment_execution/promptRunner";
import { ExperimentService } from "../backend/api/modules/experiment/service";
import { ExperimentConfigService } from "../backend/api/modules/experiment_config/service";
import { ExperimentConfigRepository } from "../backend/api/modules/experiment_config/repository";
import { LlmService } from "../backend/api/modules/LLM/service";
import { ExperimentStateService } from "../backend/api/modules/experiment_state/service";
import { PromptService } from "../backend/api/modules/prompt/service";
import { ResultService } from "../backend/api/modules/result/service";

jest.mock("workerpool", () => ({
  pool: jest.fn(),
}));
jest.mock("../backend/api/modules/experiment/service", () => ({
  ExperimentService: {
    get_experiment_by_name: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_config/service", () => ({
  ExperimentConfigService: {
    get_config: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_config/repository", () => ({
  ExperimentConfigRepository: {
    get_data_inputs_by_dataset: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/LLM/service", () => ({
  LlmService: {
    get_llm_by_id: jest.fn(),
    get_llm_param_by_id: jest.fn(),
    create_llm_spec: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_state/service", () => ({
  ExperimentStateService: {
    is_experiment_run_pause_requested: jest.fn(),
    record_total_tasks: jest.fn(),
    record_task_started: jest.fn(),
    record_task_completed: jest.fn(),
    record_request_latency: jest.fn(),
    record_task_retry: jest.fn(),
    record_task_failed: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/prompt/service", () => ({
  PromptService: {
    get_prompt_template_by_id: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/result/service", () => ({
  ResultService: {
    get_results_for_run_and_config: jest.fn(),
  },
}));

const mockedExperimentService = jest.mocked(ExperimentService);
const mockedConfigService = jest.mocked(ExperimentConfigService);
const mockedConfigRepository = jest.mocked(ExperimentConfigRepository);
const mockedLlmService = jest.mocked(LlmService);
const mockedStateService = jest.mocked(ExperimentStateService);
const mockedPromptService = jest.mocked(PromptService);
const mockedResultService = jest.mocked(ResultService);

describe("PromptRunner", () => {
  const config = {
    id: 11,
    experiment_id: 1,
    LLM_id: 21,
    LLM_param_id: 22,
    prompt_template_id: 31,
    final_dataset_id: 41,
    datasets: [],
  };

  let exec: jest.Mock;
  let terminate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    exec = jest.fn().mockResolvedValue({
      success: true,
      tries: 0,
      totalTokens: 200,
      latencyMs: 12,
    });
    terminate = jest.fn().mockResolvedValue(undefined);
    (workerpool.pool as jest.Mock).mockReturnValue({ exec, terminate });

    mockedExperimentService.get_experiment_by_name.mockResolvedValue({
      id: 1,
      title: "Test experiment",
      threads: 1,
      max_retry: 1,
    });
    mockedConfigService.get_config.mockResolvedValue(config);
    mockedConfigRepository.get_data_inputs_by_dataset.mockResolvedValue({
      7: { topic: "testing" },
    });
    mockedLlmService.get_llm_by_id.mockResolvedValue({
      base_model: "test-model",
      name: "Test model",
      model: "test-model",
      temp: 0,
    });
    mockedLlmService.get_llm_param_by_id.mockResolvedValue({
      id: 22,
    });
    mockedLlmService.create_llm_spec.mockReturnValue({
      name: "test-model",
      base_model: "test-model",
      model: "test-model",
      temp: 0,
    });
    mockedPromptService.get_prompt_template_by_id.mockResolvedValue({
      node_id: 31,
      value: "Explain {topic}",
      name: "Test prompt",
      iterations: 2,
      llms: [],
    });
    mockedResultService.get_results_for_run_and_config.mockResolvedValue([]);
    mockedStateService.is_experiment_run_pause_requested.mockReturnValue(false);
  });

  it("creates one worker task per remaining iteration and records completion", async () => {
    const runner = new PromptRunner(
      "Test experiment",
      1,
      [config],
      "{}",
      "run-1",
    );

    await runner.run();

    expect(exec).toHaveBeenCalledWith("processExperiment", [
      "run-1",
      11,
      {
        base_model: "test-model",
        model: "test-model",
        name: "test-model",
        temp: 0,
      },
      2,
      "Explain {topic}",
      { topic: "testing" },
      7,
      "{}",
      0,
    ]);
    expect(mockedStateService.record_total_tasks).toHaveBeenCalledWith(
      "run-1",
      2,
    );
    expect(mockedStateService.record_task_started).toHaveBeenCalledWith(
      "run-1",
    );
    expect(mockedStateService.record_request_latency).toHaveBeenCalledWith(
      "run-1",
      12,
    );
    expect(mockedStateService.record_task_completed).toHaveBeenCalledWith(
      "run-1",
      200,
    );
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it("does not recreate completed iterations when resuming a run", async () => {
    mockedResultService.get_results_for_run_and_config.mockResolvedValue([
      {
        id: 1,
        run_id: "run-1",
        config_id: 11,
        input_id: 7,
        output_result: "already done",
        start_time: new Date(),
        end_time: new Date(),
      },
    ]);

    const runner = new PromptRunner(
      "Test experiment",
      1,
      [config],
      "{}",
      "run-1",
    );

    await runner.run();

    expect(exec).toHaveBeenCalledWith("processExperiment", [
      "run-1",
      11,
      {
        base_model: "test-model",
        model: "test-model",
        name: "test-model",
        temp: 0,
      },
      1,
      "Explain {topic}",
      { topic: "testing" },
      7,
      "{}",
      0,
    ]);
  });
});
