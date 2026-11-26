import { afterAll, expect, test } from "@jest/globals";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupFlowExperiment, setupFlowTest } from "./flowTestHelpers";
import { closeTestServer, request, startTestServer } from "../routeTestHelpers";

const {
  prisma,
  ExperimentRoutes,
  ExperimentStateRoutes,
  ExperimentConfigService,
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
    await prisma.$disconnect();
  }
}, 120_000);

test("executes chained prompts and both evaluator nodes", async () => {
  const app = express();
  app.use("/experiments", ExperimentRoutes);
  app.use("/experiment_states", ExperimentStateRoutes);
  server = await startTestServer(app);

  const yamlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../files/chainPromptsWithEvals.yml",
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
  expect(nodes).toHaveLength(6);
  expect(promptConfigs).toHaveLength(3);

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

  const expectedCounts = new Map([
    ["prompt-1795620072558", 2],
    ["promptNode-eccdf1ba-5853-4700-8b29-84bb2246ee1e", 2],
    ["promptNode-ddd09d87-2b07-4b0d-b1a6-70fbdee4f635", 2],
  ]);
  for (const [name, count] of expectedCounts) {
    const promptNode = nodes.find((node) => node.name === name);
    expect(promptNode).toBeDefined();
    const config = promptConfigs.find(
      ({ prompt_template_id }) => prompt_template_id === promptNode?.id,
    );
    expect(config).toBeDefined();
    expect(
      results.filter((result) => result.config_id === config?.id),
    ).toHaveLength(count);
  }

  const evaluatorIds = nodes
    .filter((node) => node.type === "evaluator")
    .map((node) => node.id);
  const evaluations = await Promise.all(
    results.flatMap((result) =>
      evaluatorIds.map((evaluatorId) =>
        EvaluatorRepository.get_evaluation_result(result.id, evaluatorId),
      ),
    ),
  );
  expect(
    evaluations.filter((evaluation) => evaluation !== undefined),
  ).toHaveLength(4);
}, 120_000);
