import {
  applyLlmStubLatency,
  getLlmStubLatencyConfig,
  isLlmStubEnabled,
} from "../backend/api/modules/worker/llmStubLatency";

describe("LLM stub environment configuration", () => {
  it("preserves mocked responses and log-normal latency by default", () => {
    expect(isLlmStubEnabled({})).toBe(true);
    expect(getLlmStubLatencyConfig({})).toEqual({
      mode: "lognormal",
      medianLatency: 0.65,
      sigma: 0.4,
    });
  });

  it("can disable the mock to allow real LLM requests", () => {
    expect(isLlmStubEnabled({ LLM_STUB_ENABLED: "false" })).toBe(false);
  });

  it("reads fixed latency settings from the environment", () => {
    expect(
      getLlmStubLatencyConfig({
        LLM_STUB_LATENCY_MODE: "fixed",
        LLM_STUB_FIXED_LATENCY_SECONDS: "2",
      }),
    ).toEqual({ mode: "fixed", fixedLatency: 2 });
  });

  it("supports disabling stub latency", () => {
    expect(getLlmStubLatencyConfig({ LLM_STUB_LATENCY_MODE: "none" })).toEqual({
      mode: "none",
    });
  });

  it("rejects invalid environment settings", () => {
    expect(() => isLlmStubEnabled({ LLM_STUB_ENABLED: "sometimes" })).toThrow(
      "LLM_STUB_ENABLED must be true or false",
    );
    expect(() =>
      getLlmStubLatencyConfig({
        LLM_STUB_LATENCY_MODE: "fixed",
        LLM_STUB_FIXED_LATENCY_SECONDS: "-1",
      }),
    ).toThrow("LLM_STUB_FIXED_LATENCY_SECONDS must be a non-negative number");
  });
});

describe("applyLlmStubLatency", () => {
  it("does not sleep by default", async () => {
    const sleep = jest.fn(() => Promise.resolve());

    await applyLlmStubLatency({}, { sleep });

    expect(sleep).not.toHaveBeenCalled();
  });

  it("sleeps for the configured fixed latency", async () => {
    const sleep = jest.fn(() => Promise.resolve());

    await applyLlmStubLatency(
      {
        mode: "fixed",
        fixedLatency: 2,
      },
      { sleep },
    );

    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("uses the median and sigma for log-normal latency", async () => {
    const sleep = jest.fn(() => Promise.resolve());

    await applyLlmStubLatency(
      {
        mode: "lognormal",
        medianLatency: 0.65,
        sigma: 0.4,
      },
      { randomNormal: () => 0, sleep },
    );

    expect(sleep).toHaveBeenCalledWith(650);
  });

  it("rejects invalid latency configuration", async () => {
    await expect(
      applyLlmStubLatency(
        {
          mode: "fixed",
          fixedLatency: -1,
        },
        { sleep: jest.fn(() => Promise.resolve()) },
      ),
    ).rejects.toThrow("fixedLatency must be a non-negative number");
  });

  it("rejects unsupported latency modes", async () => {
    await expect(
      applyLlmStubLatency({
        mode: "unsupported" as never,
      }),
    ).rejects.toThrow("Unsupported latency mode: unsupported");
  });
});
