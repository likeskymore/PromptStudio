import { EvalProcessService } from "../backend/api/modules/eval_process/service";
import { Result } from "../backend/api/modules/result/types";
import { JoinFormat } from "../backend/api/modules/eval_process/types";

jest.mock("mdast-util-from-markdown", () => ({
  fromMarkdown: () => ({ children: [] }),
}));

jest.mock("../backend/api/ChainForgeUtils/utils", () => ({
  compileTextFromMdAST: () => "",
  processCSV: (text: string) => text.split(",").map((value) => value.trim()),
  transformDict: (source: Record<string, unknown>) => source,
}));

jest.mock("../backend/api/ChainForgeUtils/query", () => ({
  PromptPipeline: jest.fn(),
}));

const result: Result = {
  id: 42,
  config_id: 7,
  input_id: 3,
  output_result: "hello",
  start_time: new Date("2024-01-01T00:00:00Z"),
  end_time: new Date("2024-01-01T00:00:01Z"),
};

describe("EvalProcessService", () => {
  it("executes a JavaScript evaluator with response context", async () => {
    const evaluated = await EvalProcessService.execute_javascript(
      "function evaluate(response) { return response.text.toUpperCase(); }",
      result,
      { tone: "friendly" },
      {},
      "test-model",
      "Say hello",
      "evaluator",
    );

    expect(evaluated).toEqual({
      response: { result_id: 42, result: "HELLO" },
      logs: [],
    });
  });

  it("reports missing evaluator functions", async () => {
    const evaluated = await EvalProcessService.execute_javascript(
      "const value = 1;",
      result,
      {},
      {},
      "",
      "",
      "evaluator",
    );

    expect(evaluated.error).toContain("evaluate() is not defined");
  });

  it("captures processor errors with the result id", async () => {
    const processed = await EvalProcessService.execute_javascript(
      "function process() { throw new Error('processor failed'); }",
      result,
      {},
      {},
      "",
      "",
      "processor",
    );

    expect(processed).toEqual({
      response: { result_id: 42, error: "processor failed" },
      logs: [],
    });
  });

  it("executes a Python evaluator with response context", async () => {
    const evaluated = await EvalProcessService.execute_python(
      "def evaluate(response):\n    return response.text.upper()",
      result,
      {},
      {},
      "test-model",
      "Say hello",
      "evaluator",
    );

    expect(evaluated).toEqual({
      response: { result_id: 42, result: "HELLO" },
      logs: [],
    });
  });

  it("reports Python evaluator errors", async () => {
    const evaluated = await EvalProcessService.execute_python(
      "def evaluate(response):\n    raise ValueError('python failed')",
      result,
      {},
      {},
      "test-model",
      "Say hello",
      "evaluator",
    );

    expect(evaluated).toEqual({
      error: "python failed",
      logs: [],
    });
  });

  it("splits a response by blank lines", async () => {
    const processed = await EvalProcessService.execute_split(
      { ...result, output_result: "first\n\nsecond" },
      {},
      {},
      "test-model",
      "Split this",
      "processor",
      "\n\n",
    );

    expect(processed).toEqual({
      response: { result_id: 42, result: ["first", "second"] },
    });
  });

  it("returns no parts when a markdown splitter finds no matching blocks", async () => {
    const processed = await EvalProcessService.execute_split(
      result,
      {},
      {},
      "test-model",
      "Split this",
      "processor",
      "list",
    );

    expect(processed).toEqual({
      response: { result_id: 42, result: [] },
    });
  });

  it("joins resolved inputs by group", async () => {
    const joined = await EvalProcessService.execute_join(
      '["Vcategory"]',
      [
        { input_id: 3, vars: { category: "one", output: "first" } },
        { input_id: 4, vars: { category: "one", output: "second" } },
        { input_id: 5, vars: { category: "two", output: "third" } },
      ],
      JoinFormat.NewLine,
    );

    expect(joined).toEqual([
      { response: { input_id: 3, result: "first\nsecond" } },
      { response: { input_id: 5, result: "third" } },
    ]);
  });

  it("reports invalid join grouping configuration", async () => {
    const joined = await EvalProcessService.execute_join(
      "not-json",
      [],
      JoinFormat.NewLine,
    );

    expect(joined).toHaveLength(1);
    expect(joined[0].error).toBeDefined();
  });
});
