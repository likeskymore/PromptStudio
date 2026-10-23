import { DatabaseClient, prisma } from "../../../database/prisma";
import { Experiment } from "../experiment/types";
import { PromptRunner } from "../experiment_execution/promptRunner";
import { LlmService } from "../LLM/service";
import { Llm_params, LLMSpec } from "../LLM/types";
import { PromptTemplate } from "./types";
import { ExperimentConfigService } from "../experiment_config/service";
import { NodeService } from "../node/service";
import { PromptRepository } from "./repository";

export const PromptService = {
  /**
   * Handles saving a prompt template to the database.
   * It saves the template itself, its associated LLMs, and their parameters.
   * @param template The prompt template to save.
   * @param connection The database connection to use for saving.
   * @param experiment_id The ID of the experiment to which the template belongs.
   */
  async handle_save_template(
    template: PromptTemplate,
    connection: DatabaseClient,
    experiment_id: number,
  ) {
    const node_id = await NodeService.handle_save_node(
      "prompt_template",
      experiment_id,
      template.name,
      connection,
    );
    await PromptRepository.save_template(
      template.value,
      template.name,
      template.iterations || 1,
      node_id,
      connection,
    );
    // Save 1 config for each LLM in the template
    for (const llm of template.llms as LLMSpec[]) {
      const existing = await LlmService.get_llm_by_base_model(
        llm.base_model,
        connection,
      );
      const llm_id = existing
        ? existing.id
        : await LlmService.handle_save_llm(llm, connection);

      const llm_params: Partial<Llm_params> = LlmService.build_LLM_Params(llm);

      const llm_param_id = await LlmService.handle_save_llm_param(
        llm_params,
        connection,
      );
      await PromptRepository.save_promptconfig(
        experiment_id,
        llm_id,
        llm_param_id,
        node_id,
        null,
        connection,
      );
    }
  },

  fillTemplate(template: string, vars: Record<string, string>): string {
    let result = template;

    const regex = /\{([^}]+)\}/g;

    let previous: string;

    do {
      previous = result;

      result = result.replace(regex, (match, key) => {
        return vars[key] ?? match;
      });
    } while (result !== previous);

    return result;
  },
  /**
   * Runs a template by its node ID, resolving inputs and managing datasets.
   * It retrieves configurations for the template, checks if a final dataset already exists,
   * and if not, creates a new dataset with the inputs. It then updates the final datasets
   * for each configuration and runs the experiment using the ExperimentRunner.
   * @param node_id The ID of the node representing the template to run.
   * @param api_keys A dictionary of API keys to use for the experiment.
   * @param experiment The experiment object containing details like title and threads.
   * @param runId The run-state identifier associated with this execution, when available.
   * @param rerun Whether existing template outputs should be recomputed instead of reused.
   */
  async run_template(
    node_id: number,
    api_keys: string,
    experiment: Experiment,
    runId?: string,
    rerun = false,
  ) {
    try {
      const resolvedInputs =
        await ExperimentConfigService.resolve_inputs(node_id);
      const inputs = resolvedInputs.map((input) => input.vars);
      const configs =
        await ExperimentConfigService.get_configs_by_template_id(node_id);
      let dataset_id: number | undefined;
      // Check if we already have a final dataset meaning we have run this template before
      for (const config of configs) {
        if (config.final_dataset_id) {
          dataset_id = config.final_dataset_id;
          // If we have a final dataset, we can skip the dataset creation step, but we need to add the new inputs to it
          if (!rerun) {
            await ExperimentConfigService.add_rows_to_dataset(
              dataset_id,
              inputs,
            );
          }
          break;
        }
      }
      // If we don't have a final dataset, we need to create one, at first run
      if (!dataset_id) {
        const createdDatasetId =
          await ExperimentConfigService.save_dataset_inputs(
            inputs,
            experiment.id,
          );
        if (!createdDatasetId) {
          throw new Error(
            `Unable to create dataset for experiment ${experiment.title}`,
          );
        }
        dataset_id = createdDatasetId;
      }
      if (!dataset_id) {
        throw new Error(
          `Unable to resolve dataset for experiment ${experiment.title}`,
        );
      }
      const promises: Promise<void>[] = [];
      for (const config of configs) {
        promises.push(
          ExperimentConfigService.update_final_dataset(
            config.id,
            dataset_id,
          ),
        );
      }
      await Promise.all(promises);
      const num_workers = experiment.threads || 1;
      const runner = new PromptRunner(
        experiment.title,
        num_workers,
        configs,
        api_keys,
        runId,
        rerun,
      );
      await runner.run();
    } catch (error) {
      console.error(`Error running template ${node_id}:`, error);
    }
  },
  async get_prompt_config_by_experiment(
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return PromptRepository.get_prompt_config_by_experiment(
      experiment_id,
      connection,
    );
  },
  async get_prompt_template_by_id(
    template_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return PromptRepository.get_prompt_template_by_id(template_id, connection);
  },
};
