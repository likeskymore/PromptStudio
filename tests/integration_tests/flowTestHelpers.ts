import fs, { type PathLike } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../../generated/prisma/client";

export async function setupFlowTest(apiKeys: Record<string, string> = {}) {
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const overrideReadFileSync = ((filePath: PathLike, options?: any) => {
    if (String(filePath).endsWith("credentials.json")) {
      return JSON.stringify({ api_keys: apiKeys });
    }
    return originalReadFileSync(filePath, options);
  }) as typeof fs.readFileSync;

  fs.readFileSync = overrideReadFileSync;
  syncBuiltinESMExports();
  Object.assign(globalThis, {
    __dirname: path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../backend/api/modules/experiment",
    ),
  });

  try {
    const { prisma } = await import("../../backend/database/prisma");
    const { ExperimentRoutes } =
      await import("../../backend/api/modules/experiment/route");
    const { ExperimentStateRoutes } =
      await import("../../backend/api/modules/experiment_state/route");
    const { ExperimentConfigService } =
      await import("../../backend/api/modules/experiment_config/service");
    const { ExperimentService } =
      await import("../../backend/api/modules/experiment/service");
    const { ExperimentRepository } =
      await import("../../backend/api/modules/experiment/repository");
    const { ExperimentStateRepository } =
      await import("../../backend/api/modules/experiment_state/repository");
    const { NodeRepository } =
      await import("../../backend/api/modules/node/repository");
    const { PromptRepository } =
      await import("../../backend/api/modules/prompt/repository");
    const { ResultRepository } =
      await import("../../backend/api/modules/result/repository");
    const { EvaluatorRepository } =
      await import("../../backend/api/modules/evaluator/repository");

    return {
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
    };
  } finally {
    fs.readFileSync = originalReadFileSync;
    syncBuiltinESMExports();
  }
}

export async function cleanupFlowExperiment(
  prisma: PrismaClient,
  experimentTitle: string,
  deleteExperiment: (experimentId: number) => Promise<void>,
) {
  const experiment = await prisma.experiment.findUnique({
    where: { title: experimentTitle },
    include: { nodes: true, promptConfigs: true },
  });
  if (!experiment) return;

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const activeRun = await prisma.experimentRun.findFirst({
      where: {
        experimentId: experiment.id,
        status: { in: ["running", "queued"] },
      },
      select: { runId: true },
    });
    if (!activeRun) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  const activeRun = await prisma.experimentRun.findFirst({
    where: {
      experimentId: experiment.id,
      status: { in: ["running", "queued"] },
    },
    select: { runId: true },
  });
  if (activeRun) {
    throw new Error(
      `Cannot clean up experiment ${experimentTitle} while run ${activeRun.runId} is active`,
    );
  }

  const evaluatorNodeIds = experiment.nodes
    .filter((node) => node.type === "evaluator")
    .map((node) => node.id);
  const graderConfigs = await prisma.llmEvaluator.findMany({
    where: { nodeId: { in: evaluatorNodeIds } },
    select: { llmId: true, llmParamId: true },
  });
  const llmIds = [
    ...new Set([
      ...experiment.promptConfigs.map(({ llmId }) => llmId),
      ...graderConfigs.map(({ llmId }) => llmId),
    ]),
  ];
  const llmParamIds = [
    ...new Set([
      ...experiment.promptConfigs.map(({ llmParamId }) => llmParamId),
      ...graderConfigs.map(({ llmParamId }) => llmParamId),
    ]),
  ];

  await deleteExperiment(experiment.id);
  await prisma.llmParam.deleteMany({ where: { id: { in: llmParamIds } } });
  await prisma.llm.deleteMany({
    where: {
      id: { in: llmIds },
      promptConfigs: { none: {} },
      evaluators: { none: {} },
    },
  });
}
