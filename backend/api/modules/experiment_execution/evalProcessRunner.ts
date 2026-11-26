import { ExperimentConfigService } from "../experiment_config/service";
import { LlmService } from "../LLM/service";
import { NodeType } from "../node/types";
import { Processor_type, ProcessorResult } from "../processor/types";
import { PromptService } from "../prompt/service";
import { EvaluationTask } from "./types";
import * as workerpool from "workerpool";
import path from "node:path";
import { NodeService } from "../node/service";
import { ProcessorService } from "../processor/service";
import { ResultService } from "../result/service";
import { EvaluatorService } from "../evaluator/service";

/**
 * Produces evaluator or processor tasks and consumes them with worker threads.
 * Join and split processors use resolved-input tasks instead of individual LLM results.
 */
export class EvalProcessRunner {
  private taskQueue: EvaluationTask[] = [];
  private isProducing = true;
  private errors = 0;
  private pool: workerpool.Pool;
  constructor(
    private experiment_name: string,
    private num_workers: number,
    private node_id: number,
    private api_keys = "{}",
  ) {
    const workerPath = path.resolve(
      process.cwd(),
      "backend/api/modules/worker/worker.ts",
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
   * Evaluates the results by producing tasks and processing them using worker threads.
   * It retrieves links by target node, fetches inputs and results, and adds them to the task queue.
   * Each worker thread will execute the `evaluate` function to process the tasks
   */
  public async evaluate() {
    await Promise.all([
      this.produceTasks(),
      ...Array.from({ length: this.num_workers }, () => this.taskEvaluator()),
    ]);
    await this.pool.terminate();
  }

  /**
   * Processes the results by producing tasks and processing them using worker threads.
   * It retrieves links by target node, fetches inputs and processor results, and adds them
   * to the task queue.
   * Each worker thread will execute the `process` function to process the tasks.
   */
  public async process() {
    await Promise.all([
      this.produceTasks(),
      ...Array.from({ length: this.num_workers }, () => this.taskProcessor()),
    ]);
    await this.pool.terminate();
  }

  /**
   * Process tasks for join and split processors. It retrieves resolved inputs and creates tasks based on the processor type.
   * For join processors, a single task is created with all resolved inputs.
   * For split processors, individual tasks are created for each resolved input.
   * @param parent_node_id The ID of the parent node (dataset) from which to retrieve resolved inputs.
   * @param processor_type The type of the processor (join or split) to determine how to create tasks.
   * @returns An array of EvaluationTask objects representing the tasks to be processed.
   */
  private async formulateJoinAndSplitTasks(
    parent_node_id: number,
    processor_type: Processor_type,
  ): Promise<EvaluationTask[]> {
    const tasks: EvaluationTask[] = [];
    const resolvedInputs =
      await ExperimentConfigService.resolve_inputs(parent_node_id);

    if (processor_type === Processor_type.join) {
      tasks.push({
        evaluator_id: this.node_id,
        llm_spec: null,
        markersDict: null,
        template_value: null,
        result: {
          output_result: null,
          id: undefined,
          config_id: undefined,
          input_id: undefined,
          start_time: undefined,
          end_time: undefined,
        },
        input_id: null,
        resolved_input_id: null,
        resolved_inputs: resolvedInputs,
      });

      return tasks;
    }

    if (processor_type === Processor_type.split) {
      for (const resolvedInput of resolvedInputs) {
        const output_result = PromptService.fillTemplate(
          resolvedInput.vars.output ?? "",
          resolvedInput.vars,
        );

        const resolved_input_id =
          await ExperimentConfigService.handle_save_resolved_input(
            resolvedInput.input_id,
            output_result,
          );

        tasks.push({
          evaluator_id: this.node_id,
          llm_spec: null,
          markersDict: null,
          template_value: null,
          result: {
            output_result,
            id: undefined,
            config_id: undefined,
            input_id: undefined,
            start_time: undefined,
            end_time: undefined,
          },
          input_id: resolvedInput.input_id,
          resolved_input_id,
        });
      }
    }
    return tasks;
  }

  /**
   * Produces tasks for evaluation or processing based on the node type.
   * It retrieves links by target node, fetches inputs and results, and adds them to the task queue.
   * The tasks are created based on the type of the parent node (dataset, prompt template, or processor).
   * @param maximumQueueSize The maximum size of the task queue to prevent memory overflow.
   */
  private async produceTasks(maximumQueueSize: number = 1000) {
    const current_node = await NodeService.get_node_by_id(this.node_id);
    if (!current_node) {
      throw new Error(`Node ${this.node_id} was not found`);
    }
    const links = await NodeService.get_links_by_target(this.node_id);
    for (const link of links) {
      const parent_node = await NodeService.get_node_by_id(link.source_node_id);
      if (!parent_node) {
        continue;
      }
      if (parent_node.type === NodeType.dataset) {
        if (current_node.type === NodeType.processor) {
          const processor = await ProcessorService.get_processor_by_id(
            this.node_id,
          );

          if (
            processor?.type === Processor_type.join ||
            processor?.type === Processor_type.split
          ) {
            const tasks = await this.formulateJoinAndSplitTasks(
              parent_node.id,
              processor?.type,
            );
            this.taskQueue.push(...tasks);
            continue;
          }
        }
        let input_id = 0;
        const last_id = await ExperimentConfigService.get_last_input_id(
          parent_node.id,
        );
        while (input_id !== last_id) {
          const input = await ExperimentConfigService.get_next_input(
            parent_node.id,
            input_id,
          );
          if (!input) break;
          input_id = input.id;
          const markersDict =
            await ExperimentConfigService.get_marker_map(input);
          const marker = link.source_var;
          const markerValue = marker ? markersDict[marker] : undefined;
          const output_result = markerValue ?? "";
          // Check in processor_result if the input is already processed
          const result =
            await ProcessorService.get_processor_result_by_input_id(
              input.id,
              this.node_id,
            );
          if (result) {
            // If the input is already processed, skip it
            continue;
          }
          const task: EvaluationTask = {
            evaluator_id: this.node_id,
            llm_spec: null,
            markersDict: markersDict,
            template_value: null,
            result: {
              output_result: output_result,
              id: undefined,
              config_id: undefined,
              input_id: undefined,
              start_time: undefined,
              end_time: undefined,
            },
            input_id: input_id,
          };
          this.taskQueue.push(task);
        }
      } else if (parent_node.type === NodeType.prompt_template) {
        // Get results by template and add them to the task queue
        const results = await ResultService.get_results_by_template(
          parent_node.id.toString(),
        );
        const template = await PromptService.get_prompt_template_by_id(
          parent_node.id,
        );
        if (!template) {
          continue;
        }
        const template_value = template.value;
        for (const result of results) {
          // Check if the result is already processed
          // Get the node to know where to check for the result
          if (current_node.type === NodeType.evaluator) {
            const eval_result = await EvaluatorService.get_evaluation_result(
              result.id,
              this.node_id,
            );
            if (eval_result) {
              // If the result is already processed, skip it
              continue;
            }
          } else if (current_node.type === NodeType.processor) {
            const processor_result =
              await ProcessorService.get_processor_result_by_result_id(
                result.id,
                this.node_id,
              );
            if (processor_result) {
              // If the result is already processed, skip it
              continue;
            }
          }
          const config = await ExperimentConfigService.get_config(
            result.config_id,
          );
          if (!config) {
            continue;
          }
          const llm = await LlmService.get_llm_by_id(config.LLM_id);
          const llm_param = await LlmService.get_llm_param_by_id(
            config.LLM_param_id,
          );
          if (!llm || !llm_param) {
            continue;
          }
          const llm_spec = LlmService.create_llm_spec(llm, llm_param);
          const input = await ExperimentConfigService.get_input_by_id(
            result.input_id,
          );
          if (!input) {
            continue;
          }
          const markersDict =
            await ExperimentConfigService.get_marker_map(input);
          const task: EvaluationTask = {
            evaluator_id: this.node_id,
            llm_spec: llm_spec,
            markersDict: markersDict,
            template_value: template_value,
            result: result,
            input_id: null,
          };
          this.taskQueue.push(task);
        }
      } else if (parent_node.type === NodeType.processor) {
        // Get results from the processor one by one and add them to the task queue
        const processor_results: ProcessorResult[] =
          await ProcessorService.get_processor_results_by_processor_id(
            parent_node.id,
          );
        for (const processor_result of processor_results) {
          if (processor_result.result_id === undefined) {
            continue;
          }
          if (current_node.type === NodeType.evaluator) {
            const eval_result = await EvaluatorService.get_evaluation_result(
              processor_result.result_id,
              this.node_id,
            );
            if (eval_result) {
              // If the result is already processed, skip it
              continue;
            }
          } else if (current_node.type === NodeType.processor) {
            const process_result =
              await ProcessorService.get_processor_result_by_result_id(
                processor_result.result_id,
                this.node_id,
              );
            if (process_result) {
              // If the result is already processed, skip it
              continue;
            }
          }
          const result = await ResultService.get_result_by_id(
            processor_result.result_id,
          );
          if (!result) {
            continue;
          }
          const config = await ExperimentConfigService.get_config(
            result.config_id,
          );
          if (!config) {
            continue;
          }
          const llm = await LlmService.get_llm_by_id(config.LLM_id);
          const llm_param = await LlmService.get_llm_param_by_id(
            config.LLM_param_id,
          );
          if (!llm || !llm_param) {
            continue;
          }
          const llm_spec = LlmService.create_llm_spec(llm, llm_param);
          const input = await ExperimentConfigService.get_input_by_id(
            result.input_id,
          );
          if (!input) {
            continue;
          }
          const markersDict =
            await ExperimentConfigService.get_marker_map(input);
          const template = await PromptService.get_prompt_template_by_id(
            config.prompt_template_id,
          );
          if (!template) {
            continue;
          }
          const updated_result = {
            ...result,
            output_result: processor_result.processor_result,
          };
          const task: EvaluationTask = {
            evaluator_id: this.node_id,
            llm_spec: llm_spec,
            markersDict: markersDict,
            template_value: template.value,
            result: updated_result,
            input_id: processor_result.input_id ?? null,
          };
          this.taskQueue.push(task);
        }
      }
      // maximum queue size check
      while (this.taskQueue.length > maximumQueueSize) {
        await new Promise((res) => setTimeout(res, 50));
      }
    }
    this.isProducing = false;
  }

  /**
   * Evaluates tasks in the task queue using worker threads.
   */
  private async taskEvaluator() {
    while (this.isProducing || this.taskQueue.length > 0) {
      if (this.taskQueue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      const task = this.taskQueue.shift();
      if (!task) continue;

      try {
        const {
          evaluator_id,
          llm_spec,
          markersDict,
          template_value,
          result,
          input_id,
        } = task;
        await this.pool.exec("evaluate", [
          evaluator_id,
          llm_spec,
          markersDict,
          template_value,
          result,
          input_id,
          this.api_keys,
        ]);
      } catch (error) {
        console.error(
          "Error processing task:",
          error && (error as any).message ? (error as any).message : error,
        );
        this.errors++;
      }
    }
  }

  /**
   * Processes tasks in the task queue using worker threads.
   * This method is similar to taskEvaluator but is used for processing data rather than evaluating it.
   */
  private async taskProcessor() {
    while (this.isProducing || this.taskQueue.length > 0) {
      if (this.taskQueue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      const task = this.taskQueue.shift();
      if (!task) continue;

      try {
        const {
          evaluator_id,
          llm_spec,
          markersDict,
          template_value,
          result,
          input_id,
          resolved_input_id,
          resolved_inputs,
        } = task;
        await this.pool.exec("process", [
          evaluator_id,
          llm_spec,
          markersDict,
          template_value,
          result,
          input_id,
          resolved_input_id,
          resolved_inputs,
        ]);
      } catch (error) {
        console.error(
          "Error processing task:",
          error && (error as any).message ? (error as any).message : error,
        );
        this.errors++;
      }
    }
  }
}
