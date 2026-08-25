import app from "./app";
import { pauseRunningExperimentRuns } from "./runState";

const PORT = process.env.PORT || 3001;

let isShuttingDown = false;

async function shutdown(reason: string, error?: unknown) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (error) {
    console.error(reason, error);
  } else {
    console.log(reason);
  }

  try {
    await pauseRunningExperimentRuns();
    console.log("Running experiments paused successfully.");
  } catch (shutdownError) {
    console.error("Failed to pause running experiments:", shutdownError);
  }
  process.exit(error ? 1 : 0);
}

process.on("SIGINT", () => {
  void shutdown("Server interrupted, pausing running experiments before exit.");
});

process.on("SIGTERM", () => {
  void shutdown("Server terminated, pausing running experiments before exit.");
});

process.on("uncaughtException", (error) => {
  void shutdown(
    "Uncaught exception, pausing running experiments before exit.",
    error,
  );
});

process.on("unhandledRejection", (error) => {
  void shutdown(
    "Unhandled rejection, pausing running experiments before exit.",
    error,
  );
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
