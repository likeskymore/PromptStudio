type Sleep = (milliseconds: number) => Promise<void>;
type NormalRandom = () => number;

export interface LlmStubLatencyConfig {
  mode?: "none" | "fixed" | "lognormal";
  fixedLatency?: number;
  medianLatency?: number;
  sigma?: number;
}

type Environment = Record<string, string | undefined>;

interface LlmStubLatencyDependencies {
  sleep?: Sleep;
  randomNormal?: NormalRandom;
}

export function isLlmStubEnabled(env: Environment = process.env): boolean {
  const value = env.LLM_STUB_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "") {
    return true;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error("LLM_STUB_ENABLED must be true or false");
}

function readNonNegativeEnvNumber(
  env: Environment,
  name: string,
  defaultValue: number,
): number {
  const value = env[name];
  if (value === undefined) {
    return defaultValue;
  }
  if (value.trim() === "") {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parseNonNegativeNumber(name, Number(value));
}

export function getLlmStubLatencyConfig(
  env: Environment = process.env,
): LlmStubLatencyConfig {
  const mode = env.LLM_STUB_LATENCY_MODE?.trim() || "lognormal";
  if (mode === "none") {
    return { mode };
  }
  if (mode === "fixed") {
    return {
      mode,
      fixedLatency: readNonNegativeEnvNumber(
        env,
        "LLM_STUB_FIXED_LATENCY_SECONDS",
        0,
      ),
    };
  }
  if (mode === "lognormal") {
    return {
      mode,
      medianLatency: readNonNegativeEnvNumber(
        env,
        "LLM_STUB_MEDIAN_LATENCY_SECONDS",
        0.65,
      ),
      sigma: readNonNegativeEnvNumber(env, "LLM_STUB_LATENCY_SIGMA", 0.4),
    };
  }
  throw new Error(`Unsupported latency mode: ${mode}`);
}

function parseNonNegativeNumber(name: string, value: number): number {
  const parsed = value;
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parsed;
}

function standardNormalRandom(): number {
  const first = Math.max(Number.EPSILON, Math.random());
  const second = Math.max(Number.EPSILON, Math.random());
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

/**
 * Applies the configured latency for the LLM stub.
 * Latency values are expressed in seconds, while the sleep function receives milliseconds.
 */
export async function applyLlmStubLatency(
  config: LlmStubLatencyConfig = {},
  dependencies: LlmStubLatencyDependencies = {},
): Promise<void> {
  const sleep =
    dependencies.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const mode = config.mode ?? "none";

  if (mode === "none") {
    return;
  }

  let latencySeconds: number;
  if (mode === "fixed") {
    latencySeconds = parseNonNegativeNumber(
      "fixedLatency",
      config.fixedLatency ?? 0,
    );
  } else if (mode === "lognormal") {
    const medianLatency = parseNonNegativeNumber(
      "medianLatency",
      config.medianLatency ?? 0.65,
    );
    const sigma = parseNonNegativeNumber("sigma", config.sigma ?? 0.4);
    if (medianLatency === 0) {
      return;
    }
    latencySeconds = Math.exp(
      Math.log(medianLatency) +
        sigma * (dependencies.randomNormal ?? standardNormalRandom)(),
    );
    if (!Number.isFinite(latencySeconds)) {
      throw new Error("Configured log-normal latency is too large");
    }
  } else {
    throw new Error(`Unsupported latency mode: ${mode}`);
  }

  if (latencySeconds > 0) {
    await sleep(latencySeconds * 1000);
  }
}
