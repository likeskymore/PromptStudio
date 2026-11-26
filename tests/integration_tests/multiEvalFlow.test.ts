import { afterAll, expect, test } from "@jest/globals";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupFlowExperiment, setupFlowTest } from "./flowTestHelpers";
import { closeTestServer, request, startTestServer } from "../routeTestHelpers";

let openAiRequestCount = 0;
const apiKeys = {
  OpenAI: "integration-test-key",
  OpenAI_BaseURL: "",
};
const openAiServer = await startTestServer((_req, res) => {
  openAiRequestCount += 1;
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({
      id: "chatcmpl-integration-test",
      object: "chat.completion",
      created: 0,
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "SCORE: true" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  );
});
const openAiAddress = openAiServer.address();
if (!openAiAddress || typeof openAiAddress === "string") {
  throw new Error("OpenAI mock server is not listening");
}
apiKeys.OpenAI_BaseURL = `http://127.0.0.1:${openAiAddress.port}/v1`;
const {
  prisma,
  ExperimentRoutes,
  ExperimentStateRoutes,
  ExperimentConfigService,
  ExperimentService,
  ExperimentRepository,
  ExperimentStateRepository,
  NodeRepository,
  PromptRepository,
  ResultRepository,
  EvaluatorRepository,
} = await setupFlowTest();

let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
let experimentTitle: string | undefined;

afterAll(async () => {
  try {
    if (experimentTitle) {
      await cleanupFlowExperiment(
        prisma,
        experimentTitle,
        ExperimentRepository.delete_experiment_by_id,
      );
    }
  } finally {
    if (server) await closeTestServer(server);
    await closeTestServer(openAiServer);
    await prisma.$disconnect();
  }
}, 120_000);

test("executes the prompt and all multi-evaluator children", async () => {
  const app = express();
  app.post("/experiments/run/:name", async (req, res) => {
    const runId = await ExperimentService.run_experiment(
      req.params.name,
      JSON.stringify(apiKeys),
      { background: true },
    );
    res.json({ body: { runId } });
  });
  app.use("/experiments", ExperimentRoutes);
  app.use("/experiment_states", ExperimentStateRoutes);
  server = await startTestServer(app);

  const yamlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../files/multiEvalFlow.yml",
  );
  const savedExperimentTitle = await ExperimentConfigService.save_config(
    yamlPath,
    {},
  );
  experimentTitle = savedExperimentTitle;

  const experiment =
    await ExperimentRepository.get_experiment_by_name(savedExperimentTitle);
  expect(experiment).toBeDefined();
  if (!experiment) throw new Error("Saved experiment was not found");

  const nodes = await NodeRepository.get_nodes_by_experiment(experiment.id);
  const promptConfigs = await PromptRepository.get_prompt_config_by_experiment(
    experiment.id,
  );
  expect(nodes).toHaveLength(7);
  expect(promptConfigs).toHaveLength(1);

  const runResponse = await request(
    server,
    "POST",
    `/experiments/run/${encodeURIComponent(savedExperimentTitle)}`,
  );
  expect(runResponse.status).toBe(200);
  const runId = (runResponse.body.body as { runId: string }).runId;
  expect(runId).toBeTruthy();

  const deadline = Date.now() + 90_000;
  let responseStatus = 0;
  let runState:
    | { status: string; completed: number; total_tokens: number }
    | undefined;
  while (Date.now() < deadline) {
    const stateResponse = await request(
      server,
      "GET",
      `/experiment_states/state/${runId}`,
    );
    responseStatus = stateResponse.status;
    if (stateResponse.status === 200) {
      runState = stateResponse.body.body as typeof runState;
      if (runState?.status === "completed" || runState?.status === "failed") {
        break;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  expect(responseStatus).toBe(200);
  expect(runState?.status).toBe("completed");
  expect(runState?.completed).toBe(6);
  expect(runState?.total_tokens).toBe(600);

  const persistedRun =
    await ExperimentStateRepository.get_experiment_run_state_by_run_id(runId);
  expect(persistedRun?.status).toBe("completed");

  const results = (
    await Promise.all(
      promptConfigs.map((config) =>
        ResultRepository.get_results_for_run_and_config(runId, config.id),
      ),
    )
  ).flat();
  expect(results).toHaveLength(6);
  expect(
    results.every((result) => result.output_result === "Mock response 1"),
  ).toBe(true);

  const evaluatorIds = nodes
    .filter((node) => node.type === "evaluator")
    .map((node) => node.id);
  const evaluationResults = await Promise.all(
    results.flatMap((result) =>
      evaluatorIds.map((evaluatorId) =>
        EvaluatorRepository.get_evaluation_result(result.id, evaluatorId),
      ),
    ),
  );
  expect(openAiRequestCount).toBe(6);
  expect(
    evaluationResults.filter((evaluation) => evaluation !== undefined),
  ).toHaveLength(18);
}, 120_000);
