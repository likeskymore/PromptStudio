import { ProcessorRepository } from "../backend/api/modules/processor/repository";
import { ProcessorService } from "../backend/api/modules/processor/service";

jest.mock("../backend/api/modules/processor/repository", () => ({
  ProcessorRepository: {
    get_processor_by_id: jest.fn(),
    get_processor_result_by_input_id: jest.fn(),
    save_process_result: jest.fn(),
  },
}));
jest.mock(
  "../backend/api/modules/experiment_execution/evalProcessRunner",
  () => ({
    EvalProcessRunner: jest.fn(),
  }),
);
jest.mock("../backend/api/modules/node/service", () => ({
  NodeService: { handle_save_node: jest.fn() },
}));

describe("ProcessorService", () => {
  it("gets a processor through the repository", async () => {
    jest.mocked(ProcessorRepository.get_processor_by_id).mockResolvedValue({
      node_id: 3,
      name: "Normalize",
    } as never);

    await expect(ProcessorService.get_processor_by_id(3)).resolves.toEqual(
      expect.objectContaining({ node_id: 3 }),
    );
  });

  it("returns undefined when processor lookup fails", async () => {
    jest
      .mocked(ProcessorRepository.get_processor_by_id)
      .mockRejectedValue(new Error("processor lookup failed"));

    await expect(
      ProcessorService.get_processor_by_id(3),
    ).resolves.toBeUndefined();
  });

  it("saves a processor result", async () => {
    jest.mocked(ProcessorRepository.save_process_result).mockResolvedValue(51);

    await expect(
      ProcessorService.handle_save_process_result("processed", 42, 3, 7, null),
    ).resolves.toBe(51);
  });

  it("gets a processor result by input", async () => {
    jest
      .mocked(ProcessorRepository.get_processor_result_by_input_id)
      .mockResolvedValue({
        processor_result: "processed",
        processor_id: 3,
        input_id: 7,
      } as never);

    await expect(
      ProcessorService.get_processor_result_by_input_id(7, 3),
    ).resolves.toEqual(
      expect.objectContaining({ processor_result: "processed" }),
    );
  });
});
