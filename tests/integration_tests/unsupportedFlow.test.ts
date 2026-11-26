import { afterAll, expect, test } from "@jest/globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupFlowTest } from "./flowTestHelpers";

const { prisma, ExperimentConfigService } = await setupFlowTest();

afterAll(async () => {
  await prisma.$disconnect();
});

test("rejects a flow containing unsupported node types", async () => {
  const yamlPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../files/unsupportedFlow.yml",
  );

  await expect(
    ExperimentConfigService.save_config(yamlPath, {}),
  ).rejects.toThrow(/Unknown node type in configuration/);
}, 30_000);
