import "dotenv/config";
import express from "express";
import { ResponseCode, sendResponse } from "../../common/responseHandler";
import { ExperimentService } from "./service";
import { ExperimentRepository } from "./repository";
import { ExperimentStateService } from "../experiment_state/service";
import { ExperimentStateRepository } from "../experiment_state/repository";

const router = express.Router();
const apiKeyEnvironmentVariables = {
  OpenAI: "OPENAI_API_KEY",
  OpenAI_BaseURL: "OPENAI_BASE_URL",
  HuggingFace: "HUGGINGFACE_API_KEY",
  Anthropic: "ANTHROPIC_API_KEY",
  Google: "PALM_API_KEY",
  Azure_OpenAI: "AZURE_OPENAI_KEY",
  Azure_OpenAI_Endpoint: "AZURE_OPENAI_ENDPOINT",
  AlephAlpha: "ALEPH_ALPHA_API_KEY",
  AlephAlpha_BaseURL: "ALEPH_ALPHA_BASE_URL",
  AWS_Access_Key_ID: "AWS_ACCESS_KEY_ID",
  AWS_Secret_Access_Key: "AWS_SECRET_ACCESS_KEY",
  AWS_Session_Token: "AWS_SESSION_TOKEN",
  AWS_Region: "AWS_REGION",
  Together: "TOGETHER_API_KEY",
  DeepSeek: "DEEPSEEK_API_KEY",
} as const;

export function getApiKeysFromEnvironment(): Record<string, string> {
  const apiKeys: Record<string, string> = {};
  for (const [providerName, environmentName] of Object.entries(
    apiKeyEnvironmentVariables,
  )) {
    const value = process.env[environmentName];
    if (value?.trim()) apiKeys[providerName] = value;
  }
  return apiKeys;
}

function serializedApiKeysFromEnvironment(): string {
  return JSON.stringify(getApiKeysFromEnvironment());
}

router.post("/run/:name", async (req, res) => {
  try {
    const experiment_name = req.params.name;
    const runId = await ExperimentService.run_experiment(
      experiment_name,
      serializedApiKeysFromEnvironment(),
      {
        background: true,
      },
    );
    return sendResponse(res, {
      body: {
        message: `Experiment ${experiment_name} started successfully.`,
        runId,
      },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.post("/run/:name/rerun", async (req, res) => {
  try {
    const experiment_name = req.params.name;
    const runId = await ExperimentService.run_experiment(
      experiment_name,
      serializedApiKeysFromEnvironment(),
      {
        background: true,
        rerun: true,
      },
    );
    return sendResponse(res, {
      body: {
        message: `Experiment ${experiment_name} rerun started successfully.`,
        runId,
      },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const experiments =
      await ExperimentRepository.get_all_experiment_names_and_ids();

    return sendResponse(res, {
      body: {
        experiments,
      },
    });
  } catch (error) {
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.get("/:experiment_id/models", async (req, res) => {
  try {
    const experiment_id = req.params.experiment_id;
    const models = await ExperimentRepository.get_llm_models_of_experiment(
      parseInt(experiment_id, 10),
    );

    return sendResponse(res, {
      body: {
        models,
      },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.post("/run/:runId/pause", async (req, res) => {
  try {
    const runId = req.params.runId;
    await ExperimentStateService.pauseExperimentRun(runId);
    return sendResponse(res, {
      body: {
        message: `Experiment ${runId} paused successfully.`,
      },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

router.post("/run/:runId/resume", async (req, res) => {
  try {
    const persistedRun =
      await ExperimentStateRepository.get_experiment_run_state_by_run_id(
        req.params.runId,
      );
    if (!persistedRun) {
      return sendResponse(res, {
        statusCode: 404,
        responseCode: ResponseCode.ERROR,
        body: { error: `Run ${req.params.runId} not found` },
      });
    }
    const runId = await ExperimentService.run_experiment(
      persistedRun.experiment_name,
      serializedApiKeysFromEnvironment(),
      {
        background: true,
        resumeRunId: persistedRun.run_id,
      },
    );

    return sendResponse(res, {
      body: {
        message: `Experiment ${persistedRun.experiment_name} resumed successfully.`,
        runId,
      },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {
      statusCode: 409,
      responseCode: ResponseCode.ERROR,
      body: {
        error: error instanceof Error ? error.message : "Unable to resume run",
      },
    });
  }
});

router.delete("/:experiment_id", async (req, res) => {
  try {
    const experiment_id = parseInt(req.params.experiment_id, 10);
    if (isNaN(experiment_id)) {
      return sendResponse(res, {
        statusCode: 400,
        responseCode: ResponseCode.ERROR,
        body: { message: "Invalid experiment ID" },
      });
    }
    await ExperimentRepository.delete_experiment_by_id(experiment_id);
    return sendResponse(res, {
      body: {
        message: `Experiment ${experiment_id} deleted successfully.`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ExperimentDeletionConflict") {
      return sendResponse(res, {
        statusCode: 409,
        responseCode: ResponseCode.ERROR,
        body: { message: error.message },
      });
    }
    console.error(error);
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});
router.get("/:experiment_name/tokens", async (req, res) => {
  try {
    const experiment_name = req.params.experiment_name;
    const total_tokens =
      await ExperimentService.get_total_token_count_for_experiment(
        experiment_name,
      );
    return sendResponse(res, {
      body: { total_tokens },
    });
  } catch (error) {
    console.error(error);
    return sendResponse(res, {
      statusCode: 500,
      responseCode: ResponseCode.ERROR,
      body: {
        message:
          error instanceof Error ? error.message : "Internal Server Error",
      },
    });
  }
});

export const ExperimentRoutes = router;
