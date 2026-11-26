import { Experiment_node, Link } from "../node/types";
import { encoding_for_model, TiktokenModel } from "@dqbd/tiktoken";

/**
 * Sorts the experiment DAG with Kahn's algorithm so every node runs after its inputs.
 * @param nodes An array of Experiment_node objects representing the nodes in the experiment.
 * @param links An array of Link objects representing the edges between nodes.
 * @returns Nodes in dependency order, with evaluator nodes placed after other node types.
 */
export function topologicalSort(
  nodes: Experiment_node[],
  links: Link[],
): Experiment_node[] {
  if (nodes.length === 0) {
    return [];
  }
  if (links.length === 0) {
    return nodes; // No dependencies, return nodes as is
  }
  // Initialize in-degree and graph structures, inDegree keeps track of the number of incoming edges for each node
  const inDegree = new Map<number, number>();
  // graph keeps track of outgoing edges for each node
  const graph = new Map<number, number[]>();

  // Initialize in-degree and graph for each node
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    graph.set(node.id, []);
  }
  // Populate the graph and in-degree map based on the links
  for (const link of links) {
    graph.get(link.source_node_id)!.push(link.target_node_id);
    inDegree.set(link.target_node_id, inDegree.get(link.target_node_id)! + 1);
  }
  // Kahn's algorithm for topological sorting
  // Start with nodes that have no incoming edges (in-degree of 0)
  const queue: number[] = nodes
    .filter((n) => inDegree.get(n.id) === 0)
    .map((n) => n.id);
  const result: Experiment_node[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes.find((n) => n.id === currentId)!;
    result.push(currentNode);

    for (const neighbor of graph.get(currentId)!) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (result.length !== nodes.length) {
    throw new Error("Cycle detected in graph — dependency resolution failed.");
  }

  // Ensure that evaluators are always at the end of the sorted list because they should run after all other nodes
  const nonEvaluators = result.filter((n) => n.type !== "evaluator");
  const evaluators = result.filter((n) => n.type === "evaluator");
  return [...nonEvaluators, ...evaluators];
}

/**
 * Calculates the number of tokens in a given text for a specified model.
 * @param model - The model to use for tokenization, e.g., 'gpt2', 'gpt-3.5-turbo', etc.
 * @param text - The text to tokenize.
 */
export function getTokenCount(model: string, text: string) {
  try {
    const encoder = getEncoder(model);
    const tokens = encoder.encode(text);
    encoder.free();
    return tokens.length;
  } catch (error) {
    console.error("Error encoding text:", error);
    return 0;
  }
}

/**
 * Returns a Tiktoken encoder for the specified model.
 * If the model is not supported, it defaults to 'gpt2'.
 * @param model - The model to get the encoder for.
 */
function getEncoder(model: string) {
  try {
    return encoding_for_model(model as TiktokenModel);
  } catch (error) {
    return getEncoder("gpt2");
  }
}
