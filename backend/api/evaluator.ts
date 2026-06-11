import {Dict, PromptVarsDict} from "../typing";
import {ResponseInfo} from "../backend";
import * as vm from "node:vm";
import {Result} from "./types";
import {cleanEscapedBraces} from "../template";
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type EvalOrProcessResult = { result_id: number; result?: any; error?: any };
export type EvalOrProcessResponse = {
    response?: EvalOrProcessResult;
    logs?: string[];
    error?: string;
}

/**
 * Executes JavaScript code in a sandboxed environment.
 * The code should define a function named `evaluate` or `process` depending on the process
 * @param code - JavaScript code as a string or a function that takes a ResponseInfo object and returns a value.
 * @param result - The result object containing the output result and ID.
 * @param vars - A dictionary of prompt variables.
 * @param metavars - A dictionary of metadata variables.
 * @param llm_name - The name of the LLM used for processing.
 * @param prompt - The prompt string used in the evaluation or processing.
 * @param process_type - The type of process to execute, either "evaluator" or "processor".
 */
export async function execute_javascript(
    code: string | ((rinfo: ResponseInfo) => any),
    result: Result,
    vars: PromptVarsDict,
    metavars: Dict,
    llm_name: string,
    prompt: string,
    process_type: "evaluator" | "processor",
): Promise<EvalOrProcessResponse> {
    const req_func_name = process_type === "evaluator" ? "evaluate" : "process";

    let process_func: (rinfo: ResponseInfo) => any;
    let all_logs: string[] = [];

    if (typeof code === "string") {
        try {
            const logBuffer: string[] = [];
            const sandbox = {
                console: {
                    log: (...args: any[]) => logBuffer.push(args.join(" ")),
                    warn: (...args: any[]) => logBuffer.push(args.join(" ")),
                    error: (...args: any[]) => logBuffer.push(args.join(" ")),
                },
            };

            const context = vm.createContext(sandbox);
            vm.runInContext(code, context);

            process_func = context[req_func_name];
            if (typeof process_func !== "function") {
                return {
                    error: `${req_func_name}() is not defined in the provided code.`,
                };
            }

            all_logs = logBuffer;
        } catch (err) {
            return {
                error: `Could not compile code. Error message:\n${(err as Error).message}`,
            };
        }
    } else {
        process_func = code;
    }

    try {
        const response = await run_over_response(
            process_func,
            result,
            vars,
            metavars,
            llm_name,
            prompt,
            undefined,
        );

        return { response, logs: all_logs };
    } catch (err) {
        return {
            error: `Error encountered while trying to run "${req_func_name}" method:\n${(err as Error).message}`,
            logs: all_logs,
        };
    }
}

export async function execute_python(
    code: string | ((rinfo: ResponseInfo) => any),
    result: Result,
    vars: PromptVarsDict,
    metavars: Dict,
    llm_name: string,
    prompt: string,
    process_type: "evaluator" | "processor",
): Promise<EvalOrProcessResponse> {
    const req_func_name = process_type === "evaluator" ? "evaluate" : "process";
    let all_logs: string[] = [];

    // If code is a string, execute it by spawning a Python subprocess.
    // The Python script should define `evaluate(resp)` or `process(resp)` depending on `process_type`.
    if (typeof code === "string") {
        const tmpDir = os.tmpdir();
        const filename = `exec_python_${Date.now()}_${Math.random().toString(36).slice(2)}.py`;
        const filePath = path.join(tmpDir, filename);

        // Build a wrapper that includes the provided code and a small harness to read JSON from stdin
        // and write JSON to stdout. The harness will call the required function and emit a JSON object
        // with either `result` or `error`.
            const wrapperLines = [
                code,
                '',
                'import sys, json',
                '',
                '# Read JSON input from stdin',
                'try:',
                '    data = json.load(sys.stdin)',
                'except Exception as e:',
                '    print(json.dumps({"error": "Could not parse input JSON: " + str(e)}))',
                '    sys.exit(0)',
                '',
                '# Simple response object to provide attribute access (e.g., response.text)',
                'class _Resp:',
                '    def __init__(self, d):',
                '        self.text = d.get("output") or d.get("text")',
                '        self.prompt = d.get("prompt")',
                '        self.vars = d.get("vars")',
                '        self.metavars = d.get("metavars")',
                '        self.llm_name = d.get("llm_name")',
                '',
                `func = globals().get("${req_func_name}") or globals().get("evaluate") or globals().get("process")`,
                'if not callable(func):',
                `    print(json.dumps({"error": "${req_func_name}() is not defined in the provided code."}))`,
                '    sys.exit(0)',
                '',
                'try:',
                '    out = func(_Resp(data))',
                '    try:',
                '        print(json.dumps({"result": out}))',
                '    except TypeError:',
                '        # Fallback: non-serializable result -> convert to string',
                '        print(json.dumps({"result": str(out)}))',
                'except Exception as e:',
                '    print(json.dumps({"error": str(e)}))',
                '    sys.exit(0)',
            ];
            const wrapper = wrapperLines.join('\n');

        try {
            await fs.promises.writeFile(filePath, wrapper, { encoding: "utf8" });
            // Restrict perms on the temp file
            try { await fs.promises.chmod(filePath, 0o600); } catch (_) {}
        } catch (err) {
            return { error: `Could not write temp python file: ${(err as Error).message}` };
        }

        const pythonCmd = process.env.PYTHON || "python3";

        return await new Promise<EvalOrProcessResponse>((resolve) => {
            // Run Python in isolated mode (-I), without importing site (-S), and with a minimal environment.
            // Also run with cwd set to the tmp dir so the process has limited filesystem view.
            const child = spawn(pythonCmd, ["-I", "-S", filePath], { stdio: ["pipe", "pipe", "pipe"], cwd: tmpDir, env: {} });
            const stdoutChunks: Buffer[] = [];
            const stderrChunks: Buffer[] = [];

            const killTimeout = 10000; // ms
            const timeout = setTimeout(() => {
                try { child.kill("SIGKILL"); } catch (_) {}
            }, killTimeout);

            child.stdout.on("data", (c: Buffer) => stdoutChunks.push(c));
            child.stderr.on("data", (c: Buffer) => stderrChunks.push(c));

            child.on("error", async (err) => {
                clearTimeout(timeout);
                try { await fs.promises.unlink(filePath); } catch (_) {}
                resolve({ error: `Failed to spawn python process: ${(err as Error).message}` });
            });

            child.on("close", async () => {
                clearTimeout(timeout);
                const stdout = Buffer.concat(stdoutChunks).toString();
                const stderr = Buffer.concat(stderrChunks).toString();
                try { await fs.promises.unlink(filePath); } catch (_) {}
                if (stderr) all_logs.push(stderr);

                if (!stdout) {
                    resolve({ error: "Python process produced no output.", logs: all_logs });
                    return;
                }

                try {
                    const parsed = JSON.parse(stdout);
                    if (parsed && parsed.error) {
                        resolve({ error: parsed.error, logs: all_logs });
                    } else {
                        resolve({ response: { result_id: result.id, result: parsed.result }, logs: all_logs });
                    }
                } catch (err) {
                    resolve({ error: `Could not parse Python output as JSON: ${(err as Error).message}`, logs: all_logs.concat([stdout, stderr]) });
                }
            });

            const input = JSON.stringify({
                output: cleanEscapedBraces(result.output_result),
                prompt,
                vars,
                metavars: metavars || {},
                llm_name,
            });

            // send input and close stdin
            try {
                child.stdin.write(input);
                child.stdin.end();
            } catch (err) {
                clearTimeout(timeout);
                try { child.kill("SIGKILL"); } catch (_) {}
                resolve({ error: `Failed to send input to python process: ${(err as Error).message}` });
            }
        });
    }

    // `execute_python` expects a Python code string. Reject other types explicitly.
    return { error: "execute_python expects Python code as a string." };
}

/**
 * Runs the provided process function over the response information.
 * @param process_func - A function that takes a ResponseInfo object and returns a processed result.
 * @param result - The result object containing the output result and ID.
 * @param vars - A dictionary of prompt variables.
 * @param metavars - A dictionary of metadata variables.
 * @param llm_name - The name of the LLM used for processing.
 * @param prompt - The prompt string used in the evaluation or processing.
 * @param process_type - The type of process to execute, either "evaluator" or "processor".
 */
export async function run_over_response(
    process_func: ((resp: ResponseInfo, format?: string) => any),
    result: Result,
    vars: PromptVarsDict,
    metavars: Dict,
    llm_name: string,
    prompt: string,
    format: string | undefined,
): Promise<
    { result_id: number; result?: any; error?: string }
> {
        const r_info = new ResponseInfo(
            cleanEscapedBraces(result.output_result),
            prompt,
            vars,
            metavars || {},
            llm_name
        );

        try {
            let processed = process_func(r_info,format);
            if (processed && typeof processed.then === "function") {
                processed = await processed;
            }

            return { result_id: result.id, result: processed }
        } catch (err) {
            return {
                result_id: result.id,
                error: (err as Error).message,
            };
        }
}


// /**
//  * Runs the provided process function over the response information.
//  * @param process_func - A function that takes a ResponseInfo object and returns a processed result.
//  * @param result - The result object containing the output result and ID.
//  * @param vars - A dictionary of prompt variables.
//  * @param metavars - A dictionary of metadata variables.
//  * @param llm_name - The name of the LLM used for processing.
//  * @param prompt - The prompt string used in the evaluation or processing.
//  * @param process_type - The type of process to execute, either "evaluator" or "processor".
//  */
// export async function run_over_responses(
//     process_func: ((responses: ResponseInfo[], format?: string) => any),
//     results: Result[],
//     vars: PromptVarsDict,
//     metavars: Dict,
//     llm_name: string,
//     prompt: string,
//     process_type: "evaluator" | "processor",
// ): Promise<
//     { result_id: number; result?: any; error?: string }
// > {
//     const r_infos: ResponseInfo[] = [];
//     for (const result of results) {
//         const r_info = new ResponseInfo(
//             cleanEscapedBraces(result.output_result),
//             prompt,
//             vars,
//             metavars || {},
//             llm_name
//         );
//         r_infos.push(r_info);
//     }

//     try {
//         let processed = process_func(r_infos);
//         if (processed && typeof processed.then === "function") {
//             processed = await processed;
//         }

//         return { result_id: results[0].id, result: processed }
//     } catch (err) {
//         return {
//             result_id: results[0].id,
//             error: (err as Error).message,
//         };
//     }
// }