import { afterAll, expect, test } from "@jest/globals";
import express from "express";
import fs from "node:fs";
import os from "node:os";
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
} = await setupFlowTest();

let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
let experimentTitle: string | undefined;
let tempDir: string | undefined;

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
    if (tempDir)
      await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}, 120_000);

test("persists a config, executes its prompt, saves a result, and retrieves run state", async () => {
  const app = express();
  app.use("/experiments", ExperimentRoutes);
  app.use("/experiment_states", ExperimentStateRoutes);
  server = await startTestServer(app);

  const yamlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../files/tabularSimpleEvalFlow.yml",
  );
  const datasetRelativePath =
    "../files/table-99e38712-1dd5-4018-bc18-905407a6face.csv";
  const datasetPath = path.resolve(path.dirname(yamlPath), datasetRelativePath);
  const csvLines = (await fs.promises.readFile(datasetPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean);
  const sampleCsv = `${csvLines.slice(0, 4).join("\n")}\n`;
  tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "prompt-studio-tabular-flow-"),
  );
  const samplePath = path.join(tempDir, "sample.csv");
  await fs.promises.writeFile(samplePath, sampleCsv);
  const datasetFile: Express.Multer.File = {
    fieldname: `file:${datasetRelativePath}`,
    originalname: "sample.csv",
    encoding: "7bit",
    mimetype: "text/csv",
    size: Buffer.byteLength(sampleCsv),
    destination: tempDir,
    filename: "sample.csv",
    path: samplePath,
    buffer: Buffer.from(sampleCsv),
    stream: fs.createReadStream(samplePath),
  };
  const title = await ExperimentConfigService.save_config(yamlPath, {
    [`file:${datasetRelativePath}`]: [datasetFile],
  });
  experimentTitle = title;

  const experiment = await ExperimentRepository.get_experiment_by_name(title);
  expect(experiment).toBeDefined();
  if (!experiment) throw new Error("Saved experiment was not found");

  const nodes = await NodeRepository.get_nodes_by_experiment(experiment.id);
  const promptConfigs = await PromptRepository.get_prompt_config_by_experiment(
    experiment.id,
  );
  expect(nodes).toHaveLength(3);
  expect(promptConfigs).toHaveLength(1);

  const runResponse = await request(
    server,
    "POST",
    `/experiments/run/${encodeURIComponent(title)}`,
  );
  expect(runResponse.status).toBe(200);
  const runId = (runResponse.body.body as { runId: string }).runId;
  expect(runId).toBeTruthy();

  const deadline = Date.now() + 60_000;
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
  expect(runState?.completed).toBe(3);
  expect(runState?.total_tokens).toBe(300);

  const persistedRun =
    await ExperimentStateRepository.get_experiment_run_state_by_run_id(runId);
  expect(persistedRun?.status).toBe("completed");

  const results = await ResultRepository.get_results_for_run_and_config(
    runId,
    promptConfigs[0].id,
  );
  expect(results).toHaveLength(3);
  expect(
    results.every((result) => result.output_result === "Mock response 1"),
  ).toBe(true);
  expect(
    results.every((result) => result.config_id === promptConfigs[0].id),
  ).toBe(true);
}, 90_000);
