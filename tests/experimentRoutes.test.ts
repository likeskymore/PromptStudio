import express from "express";
import { ExperimentRoutes } from "../backend/api/modules/experiment/route";
import { ExperimentRepository } from "../backend/api/modules/experiment/repository";
import { ExperimentService } from "../backend/api/modules/experiment/service";
import { closeTestServer, request, startTestServer } from "./routeTestHelpers";

jest.mock("../backend/api/modules/experiment/repository", () => ({
  ExperimentRepository: {
    get_all_experiment_names_and_ids: jest.fn(),
    get_llm_models_of_experiment: jest.fn(),
    delete_experiment_by_id: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment/service", () => ({
  ExperimentService: {
    run_experiment: jest.fn(),
    get_total_token_count_for_experiment: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_state/repository", () => ({
  ExperimentStateRepository: {
    get_experiment_run_state_by_run_id: jest.fn(),
  },
}));
jest.mock("../backend/api/modules/experiment_state/service", () => ({
  ExperimentStateService: {
    pauseExperimentRun: jest.fn(),
  },
}));

describe("ExperimentRoutes", () => {
  let server: import("node:http").Server;

  beforeAll(async () => {
    const app = express();
    app.use("/experiments", ExperimentRoutes);
    server = await startTestServer(app);
  });

  afterAll(() => closeTestServer(server));

  it("returns experiment names and ids", async () => {
    jest
      .mocked(ExperimentRepository.get_all_experiment_names_and_ids)
      .mockResolvedValue([{ id: 1, title: "Demo" }]);

    const response = await request(server, "GET", "/experiments");

    expect(response.status).toBe(200);
    expect(response.body.body).toEqual({
      experiments: [{ id: 1, title: "Demo" }],
    });
  });

  it("starts an experiment in the background", async () => {
    jest.mocked(ExperimentService.run_experiment).mockResolvedValue("run-1");
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key";

    try {
      const response = await request(server, "POST", "/experiments/run/Demo");

      expect(response.status).toBe(200);
      expect(response.body.body).toEqual({
        message: "Experiment Demo started successfully.",
        runId: "run-1",
      });
      const call = jest
        .mocked(ExperimentService.run_experiment)
        .mock.calls.at(-1);
      expect(call?.[0]).toBe("Demo");
      expect(JSON.parse(call?.[1] ?? "{}").OpenAI).toBe("test-openai-key");
      expect(call?.[2]).toEqual({ background: true });
    } finally {
      if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("rejects an invalid experiment id", async () => {
    const response = await request(
      server,
      "DELETE",
      "/experiments/not-a-number",
    );

    expect(response.status).toBe(400);
    expect(response.body.body).toEqual({ message: "Invalid experiment ID" });
  });
});
