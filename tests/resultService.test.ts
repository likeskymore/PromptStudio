import { ResultRepository } from "../backend/api/modules/result/repository";
import { ResultService } from "../backend/api/modules/result/service";

jest.mock("../backend/api/modules/result/repository", () => ({
  ResultRepository: {
    get_result_by_id: jest.fn(),
    get_results_for_run_and_config: jest.fn(),
    save_response: jest.fn(),
  },
}));

describe("ResultService", () => {
  it("gets a result through the repository", async () => {
    jest.mocked(ResultRepository.get_result_by_id).mockResolvedValue({
      id: 42,
      output_result: "hello",
    } as never);

    await expect(ResultService.get_result_by_id(42)).resolves.toEqual(
      expect.objectContaining({ id: 42 }),
    );
  });

  it("propagates result lookup failures", async () => {
    jest
      .mocked(ResultRepository.get_result_by_id)
      .mockRejectedValue(new Error("result lookup failed"));

    await expect(ResultService.get_result_by_id(42)).rejects.toThrow(
      "result lookup failed",
    );
  });

  it("saves a response through the repository", async () => {
    jest.mocked(ResultRepository.save_response).mockResolvedValue(42);

    await expect(
      ResultService.handle_save_response(
        "run-1",
        7,
        "hello",
        3,
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:01Z",
        10,
      ),
    ).resolves.toBe(42);
  });

  it("propagates response save failures", async () => {
    jest
      .mocked(ResultRepository.save_response)
      .mockRejectedValue(new Error("response save failed"));

    await expect(
      ResultService.handle_save_response(
        "run-1",
        7,
        "hello",
        3,
        "2024-01-01T00:00:00Z",
        "2024-01-01T00:00:01Z",
        10,
      ),
    ).rejects.toThrow("response save failed");
  });
});
