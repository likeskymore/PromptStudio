import { ExperimentRepository } from "../backend/api/modules/experiment/repository";
import { ExperimentService } from "../backend/api/modules/experiment/service";
import { ExperimentStateService } from "../backend/api/modules/experiment_state/service";
import { NodeService } from "../backend/api/modules/node/service";
import { PromptService } from "../backend/api/modules/prompt/service";
import { NodeType } from "../backend/api/modules/node/types";

jest.mock("../backend/api/modules/experiment/repository", () => ({
  ExperimentRepository: {
    get_experiment_by_name: jest.fn(),
    save_experiment: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_state/service", () => ({
  ExperimentStateService: {
    complete_experiment_run: jest.fn(),
    create_experiment_run: jest.fn(),
    fail_experiment_run: jest.fn(),
    get_experiment_run_state_by_run_id: jest.fn(),
    is_experiment_run_pause_requested: jest.fn(),
    start_experiment_run: jest.fn(),
    add_experiment_run_state: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/node/service", () => ({
  NodeService: {
    get_nodes_by_experiment: jest.fn(),
    get_links_by_experiment: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/prompt/service", () => ({
  PromptService: {
    run_template: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_config/service", () => ({
  ExperimentConfigService: {},
}));
jest.mock("../backend/api/modules/LLM/service", () => ({
  LlmService: {},
}));
jest.mock("../backend/api/modules/evaluator/service", () => ({
  EvaluatorService: {},
}));
jest.mock("../backend/api/modules/result/service", () => ({
  ResultService: {},
}));
jest.mock(
  "../backend/api/modules/experiment_execution/evalProcessRunner",
  () => ({
    EvalProcessRunner: jest.fn().mockImplementation(() => ({
      evaluate: jest.fn(),
      process: jest.fn(),
    })),
  }),
);

describe("ExperimentService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates experiment lookup", async () => {
    const experiment = { id: 5, title: "Demo" };
    jest
      .mocked(ExperimentRepository.get_experiment_by_name)
      .mockResolvedValue(experiment as never);

    await expect(
      ExperimentService.get_experiment_by_name("Demo"),
    ).resolves.toEqual(experiment);
  });

  it("saves an experiment through the repository", async () => {
    jest
      .mocked(ExperimentRepository.get_experiment_by_name)
      .mockResolvedValue(undefined);
    jest.mocked(ExperimentRepository.save_experiment).mockResolvedValue(5);

    await expect(
      ExperimentService.handle_save_experiment({
        id: 0,
        title: "Demo",
        threads: 2,
      }),
    ).resolves.toBe(5);
  });

  it("returns an existing experiment instead of saving it", async () => {
    jest.mocked(ExperimentRepository.get_experiment_by_name).mockResolvedValue({
      id: 5,
      title: "Demo",
    } as never);

    await expect(
      ExperimentService.handle_save_experiment({
        id: 0,
        title: "Demo",
      }),
    ).resolves.toBe(5);
  });

  it("propagates experiment save failures", async () => {
    jest
      .mocked(ExperimentRepository.get_experiment_by_name)
      .mockResolvedValue(undefined);
    jest
      .mocked(ExperimentRepository.save_experiment)
      .mockRejectedValue(new Error("experiment save failed"));

    await expect(
      ExperimentService.handle_save_experiment({
        id: 0,
        title: "Demo",
      }),
    ).rejects.toThrow("experiment save failed");
  });

  it("runs an experiment and returns its run id", async () => {
    const experiment = { id: 5, title: "Demo" };
    const runState = {
      run_id: "run-1",
      experiment_name: "Demo",
      status: "queued",
    };
    jest
      .mocked(ExperimentRepository.get_experiment_by_name)
      .mockResolvedValue(experiment as never);
    jest
      .mocked(ExperimentStateService.create_experiment_run)
      .mockReturnValue(runState as never);
    jest
      .mocked(ExperimentStateService.start_experiment_run)
      .mockImplementation(() => undefined);
    const executeSpy = jest
      .spyOn(ExperimentService, "execute_experiment")
      .mockResolvedValue(undefined);

    try {
      await expect(
        ExperimentService.run_experiment("Demo", "{}"),
      ).resolves.toBe("run-1");
      expect(ExperimentStateService.start_experiment_run).toHaveBeenCalledWith(
        "run-1",
      );
      expect(executeSpy).toHaveBeenCalledWith(
        experiment,
        "{}",
        runState,
        expect.any(String),
        undefined,
      );
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("rejects running an unknown experiment", async () => {
    jest
      .mocked(ExperimentRepository.get_experiment_by_name)
      .mockResolvedValue(undefined);

    await expect(
      ExperimentService.run_experiment("Missing", "{}"),
    ).rejects.toThrow("Experiment Missing not found");
  });

  it("executes prompt nodes", async () => {
    const experiment = { id: 5, title: "Demo", threads: 2 };
    const runState = { run_id: "run-1" };
    const nodes = [
      {
        id: 10,
        type: NodeType.prompt_template,
        experiment_id: 5,
        name: "Prompt",
      },
    ];
    jest.mocked(NodeService.get_nodes_by_experiment).mockResolvedValue(nodes);
    jest.mocked(NodeService.get_links_by_experiment).mockResolvedValue([]);
    jest
      .mocked(ExperimentStateService.is_experiment_run_pause_requested)
      .mockReturnValue(false);
    jest
      .mocked(PromptService.run_template)
      .mockResolvedValue(undefined as never);

    await ExperimentService.execute_experiment(
      experiment,
      "{}",
      runState,
      "execution-token",
    );

    expect(PromptService.run_template).toHaveBeenCalledWith(
      10,
      "{}",
      experiment,
      "run-1",
      false,
    );
    expect(
      ExperimentStateService.is_experiment_run_pause_requested,
    ).toHaveBeenCalledWith("run-1");
  });

  it("swallows node execution failures after logging them", async () => {
    const experiment = { id: 5, title: "Demo" };
    const runState = { run_id: "run-1" };
    jest
      .mocked(NodeService.get_nodes_by_experiment)
      .mockRejectedValue(new Error("node lookup failed"));

    await ExperimentService.execute_experiment(
      experiment,
      "{}",
      runState,
      "execution-token",
    );

    expect(NodeService.get_nodes_by_experiment).toHaveBeenCalledWith(5);
  });
});
