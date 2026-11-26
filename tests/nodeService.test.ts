import { NodeRepository } from "../backend/api/modules/node/repository";
import { NodeService } from "../backend/api/modules/node/service";

jest.mock("../backend/api/modules/node/repository", () => ({
  NodeRepository: {
    save_node: jest.fn(),
    get_node_by_id: jest.fn(),
  },
}));

describe("NodeService", () => {
  it("delegates node creation and lookup", async () => {
    jest.mocked(NodeRepository.save_node).mockResolvedValue(11);
    jest.mocked(NodeRepository.get_node_by_id).mockResolvedValue({
      id: 11,
      type: "dataset",
    } as never);

    await expect(
      NodeService.handle_save_node("dataset", 2, "Inputs"),
    ).resolves.toBe(11);
    await expect(NodeService.get_node_by_id(11)).resolves.toEqual({
      id: 11,
      type: "dataset",
    });
  });

  it("propagates node save failures", async () => {
    jest
      .mocked(NodeRepository.save_node)
      .mockRejectedValue(new Error("node save failed"));

    await expect(
      NodeService.handle_save_node("dataset", 2, "Inputs"),
    ).rejects.toThrow("node save failed");
  });

  it("returns undefined when node lookup finds no node", async () => {
    jest.mocked(NodeRepository.get_node_by_id).mockResolvedValue(undefined);

    await expect(NodeService.get_node_by_id(404)).resolves.toBeUndefined();
  });
});
