import { Promptconfig } from "../experiment_config/types";
import { Task, WorkerTaskResult } from "./types";
import * as workerpool from "workerpool";
import { fileURLToPath } from "node:url";
import { ExperimentConfigService } from "../experiment_config/service";
import { ExperimentConfigRepository } from "../experiment_config/repository";
import { LlmService } from "../LLM/service";
import { ExperimentStateService } from "../experiment_state/service";
import { ExperimentService } from "../experiment/service";
import { PromptService } from "../prompt/service";
import { ResultService } from "../result/service";

/**
 * Produces prompt tasks and consumes them with a fixed worker-thread pool.
 * Database reads happen in the producer; workers perform LLM calls and writes.
 */
export class PromptRunner {
  private taskQueue: Task[] = [];
  private failedQueue: Map<number, Task[]> = new Map();
  private isProducing = true;
  private errors = 0;
  private pool: workerpool.Pool;

  /**
   * Constructor for the ExperimentRunner class.
   * @param experiment_name The name of the experiment to run.
   * @param num_workers The number of worker threads to use for processing.
   * @param configs An array of Promptconfig objects representing the configurations for the experiment.
   * @param api_keys A dictionary of API keys required for the experiment.
   */
  constructor(
    private experiment_name: string,
    private num_workers: number,
    private configs: Promptconfig[],
    private api_keys: string,
    private runId?: string,
    private rerun = false,
  ) {
    const workerPath = fileURLToPath(
      new URL("../worker/worker.ts", import.meta.url),
    );
    this.pool = workerpool.pool(workerPath, {
      minWorkers: this.num_workers,
      maxWorkers: this.num_workers,
      workerType: "process",
      forkOpts: {
        execArgv: ["--import", "tsx"],
      },
    });
  }

  /**
   * Runs the experiment by producing tasks and executing them with worker threads.
   * This method will create tasks based on the provided configurations and distribute them across the available worker threads.
   */
  async run() {
    await Promise.all([
      this.produceTasks(),
      ...Array.from({ length: this.num_workers }, () => this.taskRunner()),
    ]);
    await this.pool.terminate();
  }

  /**
   * Produces tasks for the experiment based on the provided configurations.
   */
  private async produceTasks(maximumQueueSize: number = 1000) {
    const experiment = await ExperimentService.get_experiment_by_name(
      this.experiment_name,
    );
    if (!experiment) {
      throw new Error(`Experiment ${this.experiment_name} not found`);
    }
    const experimentMaxRetry = experiment.max_retry ?? 0;
    // Create a task for each input inside each configuration for a prompt_template node
    for (const config of this.configs) {
      if (
        this.runId &&
        ExperimentStateService.isExperimentRunPauseRequested(this.runId)
      ) {
        break;
      }
      const updatedConfig = await ExperimentConfigService.get_config(
        config.id,
      );
      if (!updatedConfig) continue;
      const llm = await LlmService.get_llm_by_id(updatedConfig.LLM_id);
      const llm_param = await LlmService.get_llm_param_by_id(
        updatedConfig.LLM_param_id,
      );
      const template = await PromptService.get_prompt_template_by_id(
        updatedConfig.prompt_template_id,
      );
      if (!llm || !template) continue;
      const llm_spec = LlmService.create_llm_spec(llm, llm_param);

      const inputs =
        await ExperimentConfigRepository.get_data_inputs_by_dataset(
          updatedConfig.final_dataset_id,
        );
      const existingResults =
        this.runId && !this.rerun
          ? await ResultService.get_results_for_run_and_config(
              this.runId,
              updatedConfig.id,
            )
          : [];
      const existingResultsByInput = new Map<number, number>();
      for (const result of existingResults) {
        const inputId = result.input_id;
        if (inputId !== undefined) {
          existingResultsByInput.set(
            inputId,
            (existingResultsByInput.get(inputId) ?? 0) + 1,
          );
        }
      }

      const totalTasks = await this.calculateTotalTasks();

      if (this.runId) {
        ExperimentStateService.recordTotalTasks(this.runId, totalTasks);
      }

      // Create a task for each input in the final dataset
      for (const [inputId, markersDict] of Object.entries(inputs)) {
        if (
          this.runId &&
          ExperimentStateService.isExperimentRunPauseRequested(this.runId)
        ) {
          this.isProducing = false;
          return;
        }

        const input_id = Number(inputId);
        let iterations = template.iterations;
        if (!this.rerun) {
          iterations -= existingResultsByInput.get(input_id) ?? 0;
        }
        if (iterations <= 0) {
          continue;
        }

        this.taskQueue.push({
          config_id: updatedConfig.id,
          llm_spec,
          iterations,
          template_value: template.value,
          markersDict,
          max_retry: experimentMaxRetry,
          input_id,
          tries: 0,
        });

        while (this.taskQueue.length > maximumQueueSize) {
          if (
            this.runId &&
            ExperimentStateService.isExperimentRunPauseRequested(this.runId)
          ) {
            this.isProducing = false;
            return;
          }
          await new Promise((res) => setTimeout(res, 50));
        }
      }
    }

    this.isProducing = false;
  }

  /**
   * Runs the task runner that processes tasks from the queue.
   * This method will continuously check the task queue and the failed queue, executing tasks with worker threads until all tasks are processed.
   */
  private async taskRunner() {
    const experiment = await ExperimentService.get_experiment_by_name(
      this.experiment_name,
    );
    if (!experiment) {
      throw new Error(`Experiment ${this.experiment_name} not found`);
    }
    const experimentMaxRetry = experiment.max_retry ?? 0;
    while (
      (!this.runId ||
        !ExperimentStateService.isExperimentRunPauseRequested(this.runId)) &&
      (this.isProducing ||
        this.taskQueue.length > 0 ||
        this.failedQueue.size > 0)
    ) {
      let task: Task | undefined;

      // Prioritize main queue
      if (this.taskQueue.length > 0) {
        task = this.taskQueue.shift();
      } else if (!this.isProducing && this.failedQueue.size > 0) {
        // find the lowest available tries bucket
        const sortedTries = Array.from(this.failedQueue.keys()).sort(
          (a, b) => a - b,
        );
        for (const tries of sortedTries) {
          const bucket = this.failedQueue.get(tries);
          if (bucket && bucket.length > 0) {
            task = bucket.shift();
            if (bucket.length === 0) {
              this.failedQueue.delete(tries);
            }
            break;
          }
        }
      }

      if (!task) {
        await new Promise((res) => setTimeout(res, 50));
        continue;
      }
      await this.submitTask(task, experimentMaxRetry);
    }
  }

  /**
   * Submits a task to the worker pool for processing.
   * This method will execute the task using the worker pool and handle the result.
   * @param task The task to be processed.
   * @param experimentMaxRetry The maximum number of retries allowed for the experiment.
   */
  private async submitTask(task: Task, experimentMaxRetry: number) {
    if (this.runId) {
      ExperimentStateService.recordTaskStarted(this.runId);
    }
    const result = (await this.pool.exec("processExperiment", [
      this.runId,
      task.config_id,
      task.llm_spec,
      task.iterations,
      task.template_value,
      task.markersDict,
      task.input_id,
      this.api_keys,
      task.tries,
    ])) as WorkerTaskResult;

    if (this.runId && result.latencyMs !== undefined) {
      ExperimentStateService.recordRequestLatency(this.runId, result.latencyMs);
    }

    if (!result.success && result.tries <= experimentMaxRetry) {
      // Push to failed queue, organized by tries
      const triesBucket = this.failedQueue.get(result.tries) ?? [];
      triesBucket.push({ ...task, tries: result.tries });
      this.failedQueue.set(result.tries, triesBucket);
      if (this.runId) {
        ExperimentStateService.recordTaskRetry(
          this.runId,
          `task ${task.config_id}/${task.input_id} retry ${result.tries}`,
        );
      }
    } else if (!result.success) {
      this.errors++;
      if (this.runId) {
        ExperimentStateService.recordTaskFailed(
          this.runId,
          `task ${task.config_id}/${task.input_id} failed after ${result.tries} tries`,
        );
      }
    } else {
      if (this.runId) {
        ExperimentStateService.recordTaskCompleted(
          this.runId,
          result.totalTokens ?? 0,
        );
      }
    }
  }
  private async calculateTotalTasks(): Promise<number> {
    let totalTasks = 0;

    for (const config of this.configs) {
      const updatedConfig = await ExperimentConfigService.get_config(
        config.id,
      );
      if (!updatedConfig) continue;
      const template = await PromptService.get_prompt_template_by_id(
        updatedConfig.prompt_template_id,
      );
      if (!template) continue;

      const inputs =
        await ExperimentConfigRepository.get_data_inputs_by_dataset(
          updatedConfig.final_dataset_id,
        );
      const existingResults =
        this.runId && !this.rerun
          ? await ResultService.get_results_for_run_and_config(
              this.runId,
              updatedConfig.id,
            )
          : [];
      const existingResultsByInput = new Map<number, number>();
      for (const result of existingResults) {
        const inputId = result.input_id;
        if (inputId !== undefined) {
          existingResultsByInput.set(
            inputId,
            (existingResultsByInput.get(inputId) ?? 0) + 1,
          );
        }
      }

      for (const inputId of Object.keys(inputs)) {
        const remainingIterations =
          template.iterations -
          (existingResultsByInput.get(Number(inputId)) ?? 0);
        if (this.rerun || remainingIterations > 0) {
          totalTasks += this.rerun
            ? template.iterations
            : remainingIterations;
        }
      }
    }

    return totalTasks;
  }
}
