import { DatabaseClient, getClient, prisma } from "../../../database/prisma";
import { Experiment_node, Link } from "./types";

export const NodeRepository = {
  async save_node(
    type: string,
    experiment_id: number,
    name: string,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    try {
      const result = await getClient(connection).node.create({
        data: { type: type as any, experimentId: experiment_id, name },
      });
      return result.id;
    } catch (error) {
      throw error;
    }
  },
  async get_node_by_id(node_id: number, connection: DatabaseClient = prisma) {
    try {
      const row = await getClient(connection).node.findUnique({
        where: { id: node_id },
      });
      return row
        ? ({
            id: row.id,
            type: row.type as any,
            experiment_id: row.experimentId,
            name: row.name,
          } as Experiment_node)
        : undefined;
    } catch (error) {
      console.error("Error fetching node by ID:", error);
    }
  },
  async get_node_by_name(
    name: string,
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ): Promise<Experiment_node | undefined> {
    try {
      const result = await getClient(connection).node.findUnique({
        where: { experimentId_name: { name, experimentId: experiment_id } },
      });
      return result
        ? {
            id: result.id,
            type: result.type as any,
            experiment_id: result.experimentId,
            name: result.name,
          }
        : undefined;
    } catch (error) {
      console.error("Error fetching node by name:", error);
    }
  },
  async save_link(
    source_node_id: number,
    target_node_id: number,
    source_var: string | null,
    target_var: string | null,
    connection: DatabaseClient = prisma,
  ) {
    try {
      if (target_var === null)
        throw new Error("A link target variable is required");
      await getClient(connection).link.create({
        data: {
          sourceNodeId: source_node_id,
          targetNodeId: target_node_id,
          sourceVar: source_var,
          targetVar: target_var,
        },
      });
    } catch (error) {
      console.error("Error saving link:", error);
    }
  },
  async get_nodes_by_experiment(
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const rows = await getClient(connection).node.findMany({
        where: { experimentId: experiment_id },
      });
      return rows.map((row) => ({
        id: row.id,
        type: row.type as any,
        experiment_id: row.experimentId,
        name: row.name,
      })) as Experiment_node[];
    } catch (error) {
      console.error("Error fetching nodes by experiment:", error);
      return [];
    }
  },
  /**
   * Fetches all links between nodes in a given experiment.
   * Only includes links where both source and target nodes belong to the same experiment.
   */
  async get_links_by_experiment(
    experimentId: number,
    connection: DatabaseClient = prisma,
  ): Promise<Link[]> {
    const rows = await getClient(connection).link.findMany({
      where: { sourceNode: { experimentId }, targetNode: { experimentId } },
    });
    return rows.map((row) => ({
      source_node_id: row.sourceNodeId,
      target_node_id: row.targetNodeId,
      source_var: row.sourceVar,
      target_var: row.targetVar,
    }));
  },
  /**
   * Retrieves the parent that are datasets of a given node.
   * @param node_id
   * @param type
   * @param connection
   * @return An array of id of datasets that are parents of the given node.
   */
  async get_parents(
    node_id: number,
    type: string,
    connection: DatabaseClient = prisma,
  ): Promise<number[]> {
    try {
      const rows = await getClient(connection).link.findMany({
        where: { targetNodeId: node_id, sourceNode: { type: type as any } },
        select: { sourceNodeId: true },
        distinct: ["sourceNodeId"],
      });
      return rows.map((row) => row.sourceNodeId);
    } catch (error) {
      console.error("Error fetching parent datasets:", error);
      return [];
    }
  },

  async get_target_var(
    source_id: number,
    target_id: number,
    source_var: string,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const row = await getClient(connection).link.findFirst({
        where: {
          sourceNodeId: source_id,
          targetNodeId: target_id,
          sourceVar: source_var,
        },
        select: { targetVar: true },
      });
      return row?.targetVar;
    } catch (error) {
      console.error("Error fetching target variable:", error);
    }
  },
  async get_links_by_target(
    target_id: number,
    connection: DatabaseClient = prisma,
  ) {
    try {
      const rows = await getClient(connection).link.findMany({
        where: { targetNodeId: target_id },
      });
      return rows.map((row) => ({
        source_node_id: row.sourceNodeId,
        target_node_id: row.targetNodeId,
        source_var: row.sourceVar,
        target_var: row.targetVar,
      })) as Link[];
    } catch (error) {
      console.error("Error fetching links by target:", error);
      return [];
    }
  },
};
