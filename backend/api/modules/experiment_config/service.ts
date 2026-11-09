import path from "path";
import * as fs from "fs";
import yaml from "js-yaml";
import { DatabaseClient, prisma } from "../../../database/prisma";
import { NodeType } from "../node/types";
import { Dataset, Input, PromptVarsDict, ResolvedInput } from "./types";
import { ExperimentConfigRepository } from "./repository";
import { EvaluatorService } from "../evaluator/service";
import { ProcessorService } from "../processor/service";
import { PromptService } from "../prompt/service";
import { cartesianProduct } from "./helpers";
import { NodeService } from "../node/service";
import { ExperimentService } from "../experiment/service";
import { ResultService } from "../result/service";

export const ExperimentConfigService = {
  /**
   * Handles saving a dataset node to the database.
   * @param dataset The dataset to save.
   * @param connection The database connection to use for saving.
   * @param file_map A map of file fields to their uploaded files.
   * @param experiment_id The ID of the experiment to which the dataset belongs.
   */
  async handle_save_dataset(
    dataset: Dataset,
    connection: DatabaseClient,
    file_map: Record<string, Express.Multer.File[]>,
    experiment_id: number,
    baseDir?: string,
  ) {
    const node_id = await NodeService.handle_save_node(
      "dataset",
      experiment_id,
      dataset.name,
      connection,
    );
    const fileField = `file:${dataset.path}`;
    const datasetPath =
      file_map[fileField]?.[0]?.path ??
      (baseDir ? path.resolve(baseDir, dataset.path) : dataset.path);
    await ExperimentConfigRepository.save_dataset(
      datasetPath,
      node_id,
      dataset.name,
      connection,
    );
  },
  /**
   * Saves a configuration from a YAML file to the database.
   * @param yml_path The path to the YAML configuration file.
   * @param file_map A map of file fields to their uploaded files.
   */
  async save_config(
    yml_path: string,
    file_map: Record<string, Express.Multer.File[]>,
  ) {
    try {
      const raw = fs.readFileSync(yml_path, "utf-8");
      const parsed: any = yaml.load(raw);
      const baseDir = path.dirname(yml_path);

      return await prisma.$transaction(
        async (connection) => {
          let experimentName = parsed.experiment.title;
          let counter = 1;
          let existingExperiment = await connection.experiment.findFirst({
            where: { title: experimentName },
          });

          while (existingExperiment) {
            experimentName = `${parsed.experiment.title}_${counter++}`;
            existingExperiment = await connection.experiment.findFirst({
              where: { title: experimentName },
            });
          }

          const experiment_id = await ExperimentService.handle_save_experiment(
            { ...parsed.experiment, title: experimentName },
            connection,
          );

          for (const node of parsed.nodes) {
            if (node.template) {
              await PromptService.handle_save_template(
                node.template,
                connection,
                experiment_id,
              );
            } else if (node.dataset) {
              await this.handle_save_dataset(
                node.dataset,
                connection,
                file_map,
                experiment_id,
                baseDir,
              );
            } else if (node.evaluator) {
              const evaluatorType = String(node.evaluator.type).toLowerCase();
              if (evaluatorType === "multieval") {
                await EvaluatorService.handle_save_multi_evaluator(
                  node.evaluator,
                  connection,
                  file_map,
                  experiment_id,
                  baseDir,
                );
              } else if (evaluatorType === "llm") {
                await EvaluatorService.handle_save_llm_evaluator(
                  node.evaluator,
                  connection,
                  experiment_id,
                );
              } else if (evaluatorType === "simple") {
                await EvaluatorService.handle_save_simple_evaluator(
                  node.evaluator,
                  connection,
                  file_map,
                  experiment_id,
                  baseDir,
                );
              } else {
                await EvaluatorService.handle_save_evaluator(
                  node.evaluator,
                  connection,
                  file_map,
                  experiment_id,
                  baseDir,
                );
              }
            } else if (node.processor) {
              await ProcessorService.handle_save_processor(
                node.processor,
                connection,
                file_map,
                experiment_id,
                baseDir,
              );
            } else {
              throw new Error(
                `Unknown node type in configuration: ${JSON.stringify(node)}`,
              );
            }
          }

          for (const link of parsed.links) {
            const sourceNode = await NodeService.get_node_by_name(
              link.source,
              experiment_id,
              connection,
            );
            const targetNode = await NodeService.get_node_by_name(
              link.target,
              experiment_id,
              connection,
            );
            if (!sourceNode || !targetNode) {
              throw new Error(
                `Link error: source or target node not found for link ${JSON.stringify(link)}`,
              );
            }
            await NodeService.handle_save_link(
              sourceNode.id,
              targetNode.id,
              link.source_var || null,
              link.target_var || null,
              connection,
            );
          }

          return experimentName;
        },
        {
          maxWait: 10_000,
          timeout: 30_000,
        },
      );
    } catch (error) {
      console.error("Error saving configuration nodes:", error);
      throw error;
    }
  },
  /**
   * Recursively resolves inputs for a node by checking its parents.
   * If the node has no parents, it retrieves inputs directly from the dataset.
   * If it has parents, it resolves inputs from each parent and combines them.
   * @param node_id The ID of the node for which to resolve inputs.
   */
  async resolve_inputs(node_id: number): Promise<ResolvedInput[]> {
    const dataset_parents = await NodeService.get_parents(node_id, "dataset");
    const template_parents = await NodeService.get_parents(
      node_id,
      "prompt_template",
    );
    const processor_parents = await NodeService.get_parents(
      node_id,
      "processor",
    );

    // If no parents leaf dataset pull input rows directly
    if (
      dataset_parents.length +
        template_parents.length +
        processor_parents.length ===
      0
    ) {
      const inputs =
        await ExperimentConfigRepository.get_data_inputs_by_dataset(node_id);

      return Object.entries(inputs).map(([id, vars]) => ({
        input_id: Number(id),
        vars,
      }));
    }

    const resolved_per_parent: ResolvedInput[][] = [];

    // Otherwise recursively resolve each parent
    for (const parent_id of dataset_parents) {
      const parent_inputs = await this.resolve_inputs(parent_id);
      const targetLinks = await NodeService.get_links_by_target(node_id);
      const targetVars = new Map(
        targetLinks
          .filter((link) => link.source_node_id === parent_id)
          .map((link) => [link.source_var, link.target_var]),
      );
      const mapped_inputs: ResolvedInput[] = [];

      for (const input of parent_inputs) {
        const vars: PromptVarsDict = {};

        for (const marker of Object.keys(input.vars)) {
          const target_var = targetVars.get(marker);
          vars[target_var ?? marker] = input.vars[marker];
        }

        mapped_inputs.push({ input_id: input.input_id, vars });
      }

      resolved_per_parent.push(mapped_inputs);
    }

    for (const parent_id of template_parents) {
      const target_var = await NodeService.get_target_var(
        parent_id,
        node_id,
        "prompt",
      );
      if (!target_var) continue;

      const results = await ResultService.get_results_by_template(
        String(parent_id),
      );
      resolved_per_parent.push(
        results.map((result) => ({
          input_id: result.input_id,
          vars: { [target_var]: result.output_result },
        })),
      );
    }

    for (const parent_id of processor_parents) {
      const target_var = await NodeService.get_target_var(
        parent_id,
        node_id,
        "output",
      );
      if (!target_var) continue;

      const results =
        await ProcessorService.get_processor_results_by_processor_id(parent_id);
      resolved_per_parent.push(
        results.map((result) => ({
          input_id: result.input_id ?? 0,
          vars: { [target_var]: result.processor_result },
        })),
      );
    }

    const current_node = await NodeService.get_node_by_id(node_id);

    if (current_node?.type === NodeType.dataset) {
      const inputs =
        await ExperimentConfigRepository.get_data_inputs_by_dataset(node_id);

      resolved_per_parent.push(
        Object.entries(inputs).map(([id, vars]) => ({
          input_id: Number(id),
          vars,
        })),
      );
    }

    return cartesianProduct(resolved_per_parent);
  },
  /**
   * Generates a marker map from the input markers.
   * This function retrieves the marker names by their IDs and maps them to their corresponding values.
   * It is used to create a dictionary of markers that can be used in LLM queries.
   * @param input The Input object containing the markers to be processed.
   * @returns A dictionary where the keys are marker names and the values are their corresponding values.
   */
  async get_marker_map(input: Input) {
    const markersDict: PromptVarsDict = {};
    for (const marker of input.markers) {
      const name = await ExperimentConfigRepository.get_marker_by_id(
        marker.marker_id,
      );
      markersDict[name] = marker.value;
    }
    return markersDict;
  },
  async get_last_input_id(
    dataset_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const lastInput = await ExperimentConfigRepository.get_last_input_id(
        dataset_id,
        connection,
      );
      return lastInput ?? 0;
    } catch (error) {
      console.error("Error fetching last input ID:", error);
      throw error;
    }
  },
  async get_next_input(
    dataset_id: number,
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Input | null> {
    try {
      const nextInput = await ExperimentConfigRepository.get_next_input(
        dataset_id,
        input_id,
        connection,
      );
      return nextInput ?? null;
    } catch (error) {
      console.error("Error fetching next input:", error);
      throw error;
    }
  },
  async handle_save_resolved_input(
    source_input_id: number,
    value: string,
    connection: DatabaseClient = prisma,
  ): Promise<number | undefined> {
    try {
      const input_id = await ExperimentConfigRepository.save_resolved_input(
        source_input_id,
        value,
        connection,
      );
      return input_id ? input_id : undefined;
    } catch (error) {
      console.error("Error saving resolved input:", error);
      throw error;
    }
  },
  async get_config(config_id: number, connection: DatabaseClient = prisma) {
    try {
      const config = await ExperimentConfigRepository.get_config(
        config_id,
        connection,
      );
      return config;
    } catch (error) {
      console.error("Error fetching experiment config:", error);
      throw error;
    }
  },
  async get_input_by_id(
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Input | undefined> {
    try {
      const input = await ExperimentConfigRepository.get_input_by_id(
        input_id,
        connection,
      );
      return input;
    } catch (error) {
      console.error("Error fetching input by ID:", error);
      throw error;
    }
  },
  async get_configs_by_template_id(
    template_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const configs =
        await ExperimentConfigRepository.get_configs_by_template_id(
          template_id,
          connection,
        );
      return configs;
    } catch (error) {
      console.error("Error fetching configs by template ID:", error);
      throw error;
    }
  },
  async add_rows_to_dataset(
    dataset_id: number,
    rows: Record<string, string>[],
    connection: DatabaseClient = prisma,
  ) {
    try {
      await ExperimentConfigRepository.add_rows_to_dataset(
        dataset_id,
        rows,
        connection,
      );
    } catch (error) {
      console.error("Error adding rows to dataset:", error);
      throw error;
    }
  },
  async save_dataset_inputs(
    inputs: Record<string, string>[],
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<number | undefined> {
    try {
      const dataset_id = await ExperimentConfigRepository.save_dataset_inputs(
        inputs,
        experiment_id,
        connection,
      );
      return dataset_id ? dataset_id : undefined;
    } catch (error) {
      console.error("Error saving dataset inputs:", error);
      throw error;
    }
  },
  async update_final_dataset(
    config_id: number,
    dataset_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      await ExperimentConfigRepository.update_final_dataset(
        config_id,
        dataset_id,
        connection,
      );
    } catch (error) {
      console.error("Error updating final dataset:", error);
      throw error;
    }
  },
};
