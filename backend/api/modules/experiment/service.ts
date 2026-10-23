import { ExperimentRepository } from "./repository";
import { Promptconfig } from "../experiment_config/types";
import { ExperimentConfigService } from "../experiment_config/service";
import { PromptService } from "../prompt/service";
import { Experiment } from "./types";
import { NodeType, Experiment_node, Link } from "../node/types";
import { EvalProcessRunner } from "../experiment_execution/evalProcessRunner";
import { ExperimentStateService } from "../experiment_state/service";
import { ExperimentRunState } from "../experiment_state/types";
import { randomUUID } from "crypto";
import { getTokenCount } from "./helpers";
import { ResultService } from "../result/service";
import { LlmService } from "../LLM/service";
import { NodeService } from "../node/service";
import { DatabaseClient, prisma } from "../../../database/prisma";

const activeExecutionTokens = new Map<string, string>();

function topologicalSort(
  nodes: Experiment_node[],
  links: Link[],
): Experiment_node[] {
  if (nodes.length === 0 || links.length === 0) {
    return nodes;
  }

  const inDegree = new Map<number, number>();
  const graph = new Map<number, number[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    graph.set(node.id, []);
  }

  for (const link of links) {
    graph.get(link.source_node_id)?.push(link.target_node_id);
    inDegree.set(
      link.target_node_id,
      (inDegree.get(link.target_node_id) ?? 0) + 1,
    );
  }

  const queue = nodes
    .filter((node) => inDegree.get(node.id) === 0)
    .map((node) => node.id);
  const sorted: Experiment_node[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes.find((node) => node.id === currentId);
    if (!currentNode) continue;
    sorted.push(currentNode);

    for (const neighborId of graph.get(currentId) ?? []) {
      const degree = (inDegree.get(neighborId) ?? 0) - 1;
      inDegree.set(neighborId, degree);
      if (degree === 0) queue.push(neighborId);
    }
  }

  if (sorted.length !== nodes.length) {
    throw new Error("Cycle detected in graph — dependency resolution failed.");
  }

  const evaluators = sorted.filter((node) => node.type === NodeType.evaluator);
  return [
    ...sorted.filter((node) => node.type !== NodeType.evaluator),
    ...evaluators,
  ];
}

export const ExperimentService = {
  /**
   * Calculates the total token count for an experiment by iterating through all prompt configurations and their inputs.
   * This function retrieves the experiment by name, gets all prompt configurations associated with it,
   * and for each configuration, it retrieves the final dataset and calculates the token count for each input.
   * @param experimentName The name of the experiment for which to calculate the total token count.
   */
  async get_total_token_count_for_experiment(
    experimentName: string,
  ): Promise<number> {
    try {
      const experiment =
        await ExperimentRepository.get_experiment_by_name(experimentName);
      if (!experiment) return 0;
      const prompt_configs: Promptconfig[] =
        await PromptService.get_prompt_config_by_experiment(experiment.id);
      let totalTokens = 0;

      for (const config of prompt_configs) {
        const llm = await LlmService.get_llm_by_id(config.LLM_id);
        if (!llm) continue;
        const model = llm.base_model;
        const template = await PromptService.get_prompt_template_by_id(
          config.prompt_template_id,
        );
        if (!template) continue;

        // If we don't have a final_dataset_id yet it means the template hasn't
        // been run to create/attach a final dataset. Fall back to resolving
        // the inputs for the template node so we can estimate token usage
        // before the experiment has been executed.
        if (
          config.final_dataset_id === null ||
          config.final_dataset_id === undefined
        ) {
          const resolvedInputs = await ExperimentConfigService.resolve_inputs(
            config.prompt_template_id,
          );
          for (const resolvedInput of resolvedInputs) {
            const prompt = PromptService.fillTemplate(
              template.value,
              resolvedInput.vars,
            );
            const tokenCount = getTokenCount(model, prompt);
            // If template.iterations is set, assume we will run that many times
            totalTokens += tokenCount * (template.iterations || 1);
          }
          // move to next config
          continue;
        }

        let input_id = 0;
        const last_id = await ExperimentConfigService.get_last_input_id(
          config.final_dataset_id,
        );

        while (input_id !== last_id) {
          const input = await ExperimentConfigService.get_next_input(
            config.final_dataset_id,
            input_id,
          );
          if (!input) break;

          input_id = input.id;
          const results =
            await ResultService.get_results_by_config_and_input_id(
              config.id,
              input_id,
            );

          let remainingIterations = template.iterations;

          if (results && results.length > 0) {
            remainingIterations -= results.length;
          }
          if (remainingIterations <= 0) {
            continue;
          }

          const markersDict =
            await ExperimentConfigService.get_marker_map(input);
          const prompt = PromptService.fillTemplate(
            template.value,
            markersDict,
          );

          const tokenCount = getTokenCount(model, prompt);
          totalTokens += tokenCount * remainingIterations;
        }
      }

      return totalTokens;
    } catch (error) {
      console.error("Error computing total token count:", error);
      return 0;
    }
  },
  /**
   * Executes experiment nodes in dependency order and owns terminal run-state transitions.
   * @param experiment The experiment whose nodes should be executed.
   * @param api_keys Serialized API-key configuration passed to template runners.
   * @param runState The in-memory run state used for pause and terminal-status checks.
   * @param executionToken Token identifying the current execution so stale runs cannot
   * update the state after a resume or restart.
   * @param rerun Whether existing template outputs should be recomputed.
   */
  async execute_experiment(
    experiment: Experiment,
    api_keys: string,
    runState: { run_id: string },
    executionToken: string,
    rerun = false,
  ) {
    try {
      const nodes = await NodeService.get_nodes_by_experiment(experiment.id);
      const links = await NodeService.get_links_by_experiment(experiment.id);
      // Sort nodes topologically to ensure dependencies are resolved
      const sorted_nodes = topologicalSort(nodes, links);
      for (const node of sorted_nodes) {
        if (
          ExperimentStateService.isExperimentRunPauseRequested(runState.run_id)
        ) {
          return;
        }
        switch (node.type) {
          case NodeType.dataset:
            // Nothing to do here
            break;
          case NodeType.prompt_template:
            await PromptService.run_template(
              node.id,
              api_keys,
              experiment,
              runState.run_id,
              rerun,
            );
            break;
          case NodeType.evaluator:
            await new EvalProcessRunner(
              experiment.title,
              experiment.threads || 1,
              node.id,
            ).evaluate();
            break;
          case NodeType.processor:
            await new EvalProcessRunner(
              experiment.title,
              experiment.threads || 1,
              node.id,
            ).process();
            break;
          default:
            console.warn(`Unknown node type for node ${node.id}`);
        }
      }
      if (activeExecutionTokens.get(runState.run_id) === executionToken) {
        ExperimentStateService.completeExperimentRun(runState.run_id);
        activeExecutionTokens.delete(runState.run_id);
      }
    } catch (error) {
      if (activeExecutionTokens.get(runState.run_id) === executionToken) {
        ExperimentStateService.failExperimentRun(
          runState.run_id,
          error instanceof Error ? error.message : String(error),
        );
        activeExecutionTokens.delete(runState.run_id);
      }
      console.error(`Error running experiment ${experiment.title}:`, error);
    }
  },
  /**
   * Runs an experiment by its name, retrieving the experiment details,
   * nodes, and links from the database. It performs a topological sort on the nodes
   * to ensure that dependencies are resolved correctly before executing each node
   * based on its type (dataset, prompt template, evaluator, or processor).
   * @param experiment_name The name of the experiment to run.
   * @param api_keys A dictionary of API keys to use for the experiment.
   * @param options Optional execution controls for background, resume, and rerun behavior.
   */
  async run_experiment(
    experiment_name: string,
    api_keys: string,
    options?: { background?: boolean; resumeRunId?: string; rerun?: boolean },
  ) {
    try {
      const experiment =
        await ExperimentRepository.get_experiment_by_name(experiment_name);
      if (!experiment) {
        throw new Error(`Experiment ${experiment_name} not found`);
      }
      let runState: ExperimentRunState;
      if (options?.resumeRunId) {
        const persistedRun =
          await ExperimentStateService.get_experiment_run_state_by_run_id(
            options.resumeRunId,
          );
        if (!persistedRun || persistedRun.experiment_name !== experiment_name) {
          throw new Error(
            `Run ${options.resumeRunId} not found for experiment ${experiment_name}`,
          );
        }
        if (persistedRun.status !== "paused") {
          throw new Error(`Run ${options.resumeRunId} is not paused`);
        }
        runState = persistedRun;
        ExperimentStateService.addExperimentRunState(runState);
      } else {
        runState = ExperimentStateService.createExperimentRun(
          experiment.id,
          experiment_name,
        );
      }
      const executionToken = randomUUID();
      activeExecutionTokens.set(runState.run_id, executionToken);
      ExperimentStateService.startExperimentRun(runState.run_id);

      const runPromise = this.execute_experiment(
        experiment,
        api_keys,
        runState,
        executionToken,
        options?.rerun,
      );

      if (!options?.background) {
        await runPromise;
      }

      return runState.run_id;
    } catch (error) {
      console.error(`Error running experiment ${experiment_name}:`, error);
      throw error;
    }
  },
  async handle_save_experiment(
    experiment: Experiment,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    const existingExperiment =
      await ExperimentRepository.get_experiment_by_name(
        experiment.title,
        connection,
      );
    if (existingExperiment) {
      return existingExperiment.id;
    }
    return await ExperimentRepository.save_experiment(experiment, connection);
  },
  async get_experiment_by_name(
    experiment_name: string,
    connection: DatabaseClient = prisma,
  ): Promise<Experiment | undefined> {
    const experiment =
      await ExperimentRepository.get_experiment_by_name(
        experiment_name,
        connection,
      );
    return experiment;
  },
};
