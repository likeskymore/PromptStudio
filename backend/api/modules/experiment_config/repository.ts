import * as fs from "fs";
import { parse } from "csv-parse";
import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Input, Promptconfig, PromptVarsDict } from "./types";
import { NodeRepository } from "../node/repository";
import { computeMarkerValueHash } from "./helpers";

export const ExperimentConfigRepository = {
  /**
   * Saves a dataset to the database.
   * This function processes a CSV file, extracts markers and their values,
   * inserts them into the database, and associates them with the dataset and the template.
   * @param file The path to the CSV file containing the dataset.
   * @param node_id
   * @param name The name of the dataset to be saved.
   * @param connection
   * @return The ID of the newly created dataset.
   */
  async save_dataset(
    file: string,
    node_id: number,
    name: string,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const client = getClient(connection);
      await client.dataset.create({ data: { nodeId: node_id, name } });

      // If no file is provided, return the dataset_id immediately.
      if (!file || file.trim() === "") return node_id;

      const markers_id: Record<string, number> = {};
      const parser = fs
        .createReadStream(file)
        .pipe(parse({ columns: true, trim: true }));

      for await (const row of parser) {
        const input = await client.dataInput.create({
          data: { datasetId: node_id },
        });

        for (const marker of Object.keys(row)) {
          if (marker === "oracle") {
            await client.dataInput.update({
              where: { id: input.id },
              data: { oracle: row[marker] },
            });
            continue;
          }

          if (!(marker in markers_id)) {
            const existingMarker = await client.marker.findFirst({
              where: { marker, datasetId: node_id },
            });
            const savedMarker =
              existingMarker ??
              (await client.marker.create({
                data: { marker, datasetId: node_id },
              }));
            markers_id[marker] = savedMarker.id;
          }

          const marker_id = markers_id[marker];
          const value = row[marker];
          const hash = computeMarkerValueHash(marker_id, value);
          const markerValue = await client.markerValue.upsert({
            where: { hash },
            update: {},
            create: { markerId: marker_id, value, hash },
          });
          await client.inputMarker.create({
            data: { inputId: input.id, markerValuesId: markerValue.id },
          });
        }
      }

      return node_id;
    } catch (error) {
      console.error("Error in save_dataset:", error);
      throw error;
    }
  },
  /**
   * Fetches an input along with its associated markers from the database.
   * @param input_id The ID of the input to fetch.
   * @param connection
   * @return An Input object containing the input ID and its associated markers.
   */
  async fetch_input_with_markers(
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Input> {
    const row = await getClient(connection).dataInput.findUnique({
      where: { id: input_id },
      include: { inputMarkers: { include: { markerValue: true } } },
    });
    return {
      id: input_id,
      markers:
        row?.inputMarkers.map(({ markerValue }) => ({
          id: markerValue.id,
          marker_id: markerValue.markerId,
          value: markerValue.value,
        })) ?? [],
    };
  },
  /**
   * Retrieves an input by its ID, including its associated markers.
   * @param input_id The ID of the input to retrieve.
   * @param connection
   * @return An Input object if found, otherwise undefined.
   */
  async get_input_by_id(
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Input | undefined> {
    try {
      const exists = await getClient(connection).dataInput.findUnique({
        where: { id: input_id },
        select: { id: true },
      });
      return exists
        ? await this.fetch_input_with_markers(input_id, connection)
        : undefined;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  },
  async get_last_input_id(
    dataset_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    const row = await getClient(connection).dataInput.findFirst({
      where: { datasetId: dataset_id },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    return row?.id ?? 0;
  },
  async get_next_input(
    dataset_id: number,
    input_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Input | undefined> {
    const row = await getClient(connection).dataInput.findFirst({
      where: { datasetId: dataset_id, id: { gt: input_id } },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    return row ? this.get_input_by_id(row.id, connection) : undefined;
  },
  async get_marker_by_id(
    marker_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<string> {
    try {
      const row = await getClient(connection).marker.findUnique({
        where: { id: marker_id },
        select: { marker: true },
      });
      return row?.marker as string;
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
  async get_config(
    config_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Promptconfig | undefined> {
    try {
      const row = await getClient(connection).promptConfig.findUnique({
        where: { id: config_id },
      });
      return row
        ? {
            id: row.id,
            experiment_id: row.experimentId,
            LLM_id: row.llmId,
            LLM_param_id: row.llmParamId,
            prompt_template_id: row.promptTemplateId,
            final_dataset_id: row.finalDatasetId as number,
            datasets: [],
          }
        : undefined;
    } catch (error) {
      console.error(error);
    }
  },
  async get_configs_by_template_id(
    template_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Promptconfig[]> {
    try {
      const rows = await getClient(connection).promptConfig.findMany({
        where: { promptTemplateId: template_id },
      });
      return rows.map((row) => ({
        id: row.id,
        experiment_id: row.experimentId,
        LLM_id: row.llmId,
        LLM_param_id: row.llmParamId,
        prompt_template_id: row.promptTemplateId,
        final_dataset_id: row.finalDatasetId as number,
        datasets: [],
      }));
    } catch (error) {
      console.error("Error fetching configs by template ID:", error);
      return [];
    }
  },
  async get_data_inputs_by_dataset(
    dataset_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Record<number, PromptVarsDict>> {
    const rows = await getClient(connection).dataInput.findMany({
      where: { datasetId: dataset_id },
      include: {
        inputMarkers: {
          include: { markerValue: { include: { marker: true } } },
        },
      },
    });
    const grouped: Record<number, PromptVarsDict> = {};
    for (const row of rows) {
      grouped[row.id] = {};
      for (const { markerValue } of row.inputMarkers) {
        grouped[row.id][markerValue.marker.marker] = markerValue.value;
      }
    }
    return grouped;
  },
  async update_final_dataset(
    config_id: number,
    dataset_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      await getClient(connection).promptConfig.update({
        where: { id: config_id },
        data: { finalDatasetId: dataset_id },
      });
    } catch (error) {
      console.error("Error updating final dataset:", error);
    }
  },
  async input_exists(
    node_id: number,
    input: PromptVarsDict,
    connection: DatabaseClient = prisma,
  ): Promise<boolean> {
    const markerValueIds: number[] = [];
    const client = getClient(connection);

    for (const [marker, value] of Object.entries(input)) {
      const markerRow = await client.marker.findFirst({
        where: { marker, datasetId: node_id },
      });
      if (!markerRow) return false;

      const hash = computeMarkerValueHash(markerRow.id, value);
      const valueRow = await client.markerValue.findUnique({ where: { hash } });
      if (!valueRow) return false;

      markerValueIds.push(valueRow.id);
    }

    if (markerValueIds.length === 0) return false;
    const candidates = await client.dataInput.findMany({
      where: { datasetId: node_id },
      include: { inputMarkers: true },
    });
    return candidates.some(
      (candidate) =>
        candidate.inputMarkers.length === markerValueIds.length &&
        candidate.inputMarkers.every((marker) =>
          markerValueIds.includes(marker.markerValuesId),
        ),
    );
  },
  async add_rows_to_dataset(
    node_id: number,
    inputs: PromptVarsDict[],
    connection: DatabaseClient = prisma,
  ): Promise<void> {
    const client = getClient(connection);
    for (const input of inputs) {
      // Check if input already exists
      const exists = await this.input_exists(node_id, input, connection);
      if (exists) continue;

      const savedInput = await client.dataInput.create({
        data: { datasetId: node_id },
      });
      for (const [marker, value] of Object.entries(input)) {
        const markerRow = await client.marker.findFirst({
          where: { marker, datasetId: node_id },
        });
        const markerRecord =
          markerRow ??
          (await client.marker.create({
            data: { marker, datasetId: node_id },
          }));
        const marker_id = markerRecord.id;
        const hash = computeMarkerValueHash(marker_id, value);
        const markerValue = await client.markerValue.upsert({
          where: { hash },
          update: {},
          create: { markerId: marker_id, value, hash },
        });
        await client.inputMarker.create({
          data: { inputId: savedInput.id, markerValuesId: markerValue.id },
        });
      }
    }
  },
  async save_dataset_inputs(
    inputs: PromptVarsDict[],
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const uuid: string = crypto.randomUUID();
      const node_id = await NodeRepository.save_node(
        "dataset",
        experiment_id,
        uuid,
        connection,
      );
      await getClient(connection).dataset.create({
        data: { nodeId: node_id, name: uuid },
      });
      await this.add_rows_to_dataset(node_id, inputs, connection);
      return node_id;
    } catch (error) {
      console.error("Error saving dataset input:", error);
    }
  },
  async save_resolved_input(
    source_input_id: number,
    value: string,
    connection: DatabaseClient = prisma,
  ): Promise<number | undefined> {
    try {
      const result = await getClient(connection).resolvedInput.create({
        data: { sourceInputId: source_input_id, value },
      });
      return result.id;
    } catch (error) {
      console.error("Error saving resolved input:", error);
    }
  },
};
