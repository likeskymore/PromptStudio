import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Input, Promptconfig, PromptVarsDict } from "./types";
import { NodeRepository } from "../node/repository";
import { computeMarkerValueHash } from "./helpers";

export const ExperimentConfigRepository = {
  /**
   * Saves a dataset to the database.
   * Inserts parsed CSV rows and their marker relationships into the database.
   * @param rows The rows parsed from the dataset CSV.
   * @param node_id
   * @param name The name of the dataset to be saved.
   * @param connection
   * @return The ID of the newly created dataset.
   */
  async save_dataset(
    rows: Record<string, string>[],
    node_id: number,
    name: string,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const client = getClient(connection);
      await client.dataset.create({ data: { nodeId: node_id, name } });

      if (rows.length === 0) return node_id;

      const markerNames = new Set(
        rows.flatMap((row) =>
          Object.keys(row).filter((marker) => marker !== "oracle"),
        ),
      );
      if (markerNames.size > 0) {
        await client.marker.createMany({
          data: [...markerNames].map((marker) => ({
            marker,
            datasetId: node_id,
          })),
        });
      }

      const savedMarkers = await client.marker.findMany({
        where: { datasetId: node_id },
        select: { id: true, marker: true },
      });
      const markerIds = new Map(
        savedMarkers.map(({ marker, id }) => [marker, id]),
      );

      await client.dataInput.createMany({
        data: rows.map((row) => ({
          datasetId: node_id,
          oracle: row.oracle ?? null,
        })),
      });
      const savedInputs = await client.dataInput.findMany({
        where: { datasetId: node_id },
        orderBy: { id: "asc" },
        select: { id: true },
      });

      const markerValues = rows.flatMap((row) =>
        Object.entries(row)
          .filter(([marker]) => marker !== "oracle")
          .map(([marker, value]) => {
            const markerId = markerIds.get(marker)!;
            return {
              markerId,
              value,
              hash: computeMarkerValueHash(markerId, value),
            };
          }),
      );
      if (markerValues.length > 0) {
        await client.markerValue.createMany({
          data: markerValues,
          skipDuplicates: true,
        });
      }

      const savedMarkerValues = await client.markerValue.findMany({
        where: { hash: { in: markerValues.map(({ hash }) => hash) } },
        select: { id: true, hash: true },
      });
      const markerValueIds = new Map(
        savedMarkerValues.map(({ hash, id }) => [hash, id]),
      );
      const inputMarkers = rows.flatMap((row, inputIndex) =>
        Object.entries(row)
          .filter(([marker]) => marker !== "oracle")
          .map(([marker, value]) => {
            const markerId = markerIds.get(marker)!;
            return {
              inputId: savedInputs[inputIndex].id,
              markerValuesId: markerValueIds.get(
                computeMarkerValueHash(markerId, value),
              )!,
            };
          }),
      );
      if (inputMarkers.length > 0) {
        await client.inputMarker.createMany({ data: inputMarkers });
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
    const existingRows = await client.dataInput.findMany({
      where: { datasetId: node_id },
      include: {
        inputMarkers: {
          include: { markerValue: { include: { marker: true } } },
        },
      },
    });
    if (existingRows.length === 0 && inputs.length > 0) {
      const markerNames = new Set(
        inputs.flatMap((input) => Object.keys(input)),
      );
      const markerIds = new Map<string, number>();

      for (const marker of markerNames) {
        const row = await client.marker.create({
          data: { marker, datasetId: node_id },
        });
        markerIds.set(marker, row.id);
      }

      await client.dataInput.createMany({
        data: inputs.map(() => ({ datasetId: node_id })),
      });
      const savedInputs = await client.dataInput.findMany({
        where: { datasetId: node_id },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      const markerValues = inputs.flatMap((input) =>
        Object.entries(input).map(([marker, value]) => ({
          markerId: markerIds.get(marker)!,
          value,
          hash: computeMarkerValueHash(markerIds.get(marker)!, value),
        })),
      );
      await client.markerValue.createMany({
        data: markerValues,
        skipDuplicates: true,
      });
      const savedMarkerValues = await client.markerValue.findMany({
        where: { hash: { in: markerValues.map(({ hash }) => hash) } },
        select: { id: true, hash: true },
      });
      const markerValueIds = new Map(
        savedMarkerValues.map(({ hash, id }) => [hash, id]),
      );
      await client.inputMarker.createMany({
        data: inputs.flatMap((input, inputIndex) =>
          Object.entries(input).map(([marker, value]) => ({
            inputId: savedInputs[inputIndex].id,
            markerValuesId: markerValueIds.get(
              computeMarkerValueHash(markerIds.get(marker)!, value),
            )!,
          })),
        ),
      });
      return;
    }

    const inputSignature = (input: PromptVarsDict) =>
      JSON.stringify(
        Object.entries(input).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    const existingSignatures = new Set(
      existingRows.map((row) =>
        inputSignature(
          Object.fromEntries(
            row.inputMarkers.map(({ markerValue }) => [
              markerValue.marker.marker,
              markerValue.value,
            ]),
          ),
        ),
      ),
    );
    const markerIds = new Map<string, number>();
    for (const row of existingRows) {
      for (const { markerValue } of row.inputMarkers) {
        markerIds.set(markerValue.marker.marker, markerValue.markerId);
      }
    }

    for (const input of inputs) {
      if (existingSignatures.has(inputSignature(input))) continue;

      const savedInput = await client.dataInput.create({
        data: { datasetId: node_id },
      });
      for (const [marker, value] of Object.entries(input)) {
        let marker_id = markerIds.get(marker);
        if (marker_id === undefined) {
          const markerRecord = await client.marker.create({
            data: { marker, datasetId: node_id },
          });
          marker_id = markerRecord.id;
          markerIds.set(marker, marker_id);
        }
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
      existingSignatures.add(inputSignature(input));
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
