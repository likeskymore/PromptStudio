import { ExperimentStateRepository } from "../backend/api/modules/experiment_state/repository";
import { ExperimentStateService } from "../backend/api/modules/experiment_state/service";

jest.mock("../backend/api/modules/experiment_state/repository", () => ({
  ExperimentStateRepository: {
    upsert_experiment_run_snapshot: jest.fn(),
    get_experiment_run_state_by_run_id: jest.fn(),
    get_experiment_runs_metadata: jest.fn(),
  },
}));

describe("ExperimentStateService", () => {
  it("rejects pausing an unknown run", async () => {
    await expect(
      ExperimentStateService.pauseExperimentRun("missing-run"),
    ).rejects.toThrow("Run missing-run not found");
  });

  it("persists newly created run state", () => {
    jest
      .mocked(ExperimentStateRepository.upsert_experiment_run_snapshot)
      .mockResolvedValue(undefined);

    const state = ExperimentStateService.create_experiment_run(1, "Demo");

    expect(state).toEqual(
      expect.objectContaining({
        experiment_id: 1,
        experiment_name: "Demo",
        status: "queued",
      }),
    );
    expect(
      ExperimentStateRepository.upsert_experiment_run_snapshot,
    ).toHaveBeenCalledWith(expect.objectContaining({ run_id: state.run_id }));
  });

  it("returns persisted run state", async () => {
    jest
      .mocked(ExperimentStateRepository.get_experiment_run_state_by_run_id)
      .mockResolvedValue({
        run_id: "run-1",
        experiment_name: "Demo",
        status: "running",
      } as never);

    await expect(
      ExperimentStateService.get_experiment_run_state_by_run_id("run-1"),
    ).resolves.toEqual(
      expect.objectContaining({ run_id: "run-1", status: "running" }),
    );
  });

  it("returns undefined for an unknown persisted run", async () => {
    jest
      .mocked(ExperimentStateRepository.get_experiment_run_state_by_run_id)
      .mockResolvedValue(undefined);

    await expect(
      ExperimentStateService.get_experiment_run_state_by_run_id("missing"),
    ).resolves.toBeUndefined();
  });
});
