import express from "express";
import { ExperimentStateRoutes } from "../backend/api/modules/experiment_state/route";
import { ExperimentStateRepository } from "../backend/api/modules/experiment_state/repository";
import { ExperimentStateService } from "../backend/api/modules/experiment_state/service";
import { closeTestServer, request, startTestServer } from "./routeTestHelpers";

jest.mock("../backend/api/modules/experiment_state/repository", () => ({
  ExperimentStateRepository: {
    get_experiment_runs_metadata: jest.fn(),
    get_experiment_run_state_by_run_id: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_state/service", () => ({
  ExperimentStateService: {
    get_experiment_run: jest.fn(),
    subscribe_experiment_run: jest.fn(),
  },
}));

describe("ExperimentStateRoutes", () => {
  let server: import("node:http").Server;

  beforeAll(async () => {
    const app = express();
    app.use("/experiment_states", ExperimentStateRoutes);
    server = await startTestServer(app);
  });

  afterAll(() => closeTestServer(server));

  it("returns persisted run metadata", async () => {
    jest
      .mocked(ExperimentStateRepository.get_experiment_runs_metadata)
      .mockResolvedValue([]);

    const response = await request(server, "GET", "/experiment_states");

    expect(response.status).toBe(200);
    expect(response.body.body).toEqual({ experiment_states_metadata: [] });
  });

  it("returns 404 for an unknown run snapshot", async () => {
    jest
      .mocked(ExperimentStateRepository.get_experiment_run_state_by_run_id)
      .mockResolvedValue(undefined);

    const response = await request(
      server,
      "GET",
      "/experiment_states/state/missing",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Run missing not found" });
  });

  it("returns 404 for an unknown event stream", async () => {
    jest
      .mocked(ExperimentStateService.get_experiment_run)
      .mockReturnValue(undefined);

    const response = await request(
      server,
      "GET",
      "/experiment_states/state/missing/events",
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Run missing not found" });
  });
});
