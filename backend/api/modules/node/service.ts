import { DatabaseClient, prisma } from "../../../database/prisma";
import { NodeRepository } from "./repository";

export const NodeService = {
  async handle_save_node(
    type: string,
    experiment_id: number,
    name: string,
    connection: DatabaseClient = prisma,
  ): Promise<number> {
    const node_id = await NodeRepository.save_node(
      type,
      experiment_id,
      name,
      connection,
    );
    return node_id;
  },
  async get_nodes_by_experiment(
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await NodeRepository.get_nodes_by_experiment(
      experiment_id,
      connection,
    );
  },
  async get_links_by_experiment(
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await NodeRepository.get_links_by_experiment(
      experiment_id,
      connection,
    );
  },
  async get_node_by_id(node_id: number, connection: DatabaseClient = prisma) {
    return await NodeRepository.get_node_by_id(node_id, connection);
  },
  async get_node_by_name(
    name: string,
    experiment_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await NodeRepository.get_node_by_name(
      name,
      experiment_id,
      connection,
    );
  },
  async get_parents(
    node_id: number,
    type: string,
    connection: DatabaseClient = prisma,
  ) {
    return await NodeRepository.get_parents(node_id, type, connection);
  },
  async get_target_var(
    source_id: number,
    target_id: number,
    source_var: string,
    connection: DatabaseClient = prisma,
  ) {
    return await NodeRepository.get_target_var(
      source_id,
      target_id,
      source_var,
      connection,
    );
  },
  async handle_save_link(
    source_node_id: number,
    target_node_id: number,
    source_var: string | null,
    target_var: string | null,
    connection: DatabaseClient = prisma,
  ) {
    await NodeRepository.save_link(
      source_node_id,
      target_node_id,
      source_var,
      target_var,
      connection,
    );
  },
  async get_links_by_target(
    target_node_id: number,
    connection: DatabaseClient = prisma,
  ) {
    return await NodeRepository.get_links_by_target(target_node_id, connection);
  },
};
