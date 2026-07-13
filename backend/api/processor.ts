import { fromMarkdown } from "mdast-util-from-markdown";
import { escapeBraces } from "../template";
import { compileTextFromMdAST, processCSV } from "../utils";
import { ResponseInfo } from "../backend";
import { ResolvedInput, Result } from "./types";
import { Dict, PromptVarsDict } from "../typing";
import { EvalOrProcessResponse, run_over_response } from "./evaluator";
import { fillTemplate } from "./configHandler";

enum JoinFormat {
  DubNewLine = "\n\n",
  NewLine = "\n",
  DashedList = "-",
  NumList = "1.",
  PyArr = "[]",
}

export async function execute_split(
  result: Result,
  vars: PromptVarsDict,
  metavars: Dict,
  llm_name: string,
  prompt: string,
  process_type: "processor",
  format: string,
): Promise<EvalOrProcessResponse> {
  const req_func_name = process_type;

  let process_func = splitText;

  try {
    const response = await run_over_response(
      process_func,
      result,
      vars,
      metavars,
      llm_name,
      prompt,
      format,
    );

    return { response };
  } catch (err) {
    return {
      error: `Error encountered while trying to run "${req_func_name}" method:\n${(err as Error).message}`,
    };
  }
}

export async function execute_join(
  selected_group_vars: string,
  resolved_inputs: ResolvedInput[],
  format: string,
): Promise<EvalOrProcessResponse[]> {
  try {
    const joinFormat = format.replace(/\\n/g, "\n") as JoinFormat;

    const vars = (JSON.parse(selected_group_vars) as string[])
      .filter((v) => v.startsWith("V"))
      .map((v) => v.substring(1));

    function groupInputs(
      inputs: ResolvedInput[],
      remainingVars: string[],
    ): ResolvedInput[][] {
      if (inputs.length === 0) {
        return [];
      }

      // Base case: keep this group intact
      if (remainingVars.length === 0) {
        return [inputs];
      }

      const currentVar = remainingVars[0];

      const groups = new Map<string, ResolvedInput[]>();
      const leftover: ResolvedInput[] = [];

      for (const input of inputs) {
        const value = input.vars[currentVar];

        if (value === undefined) {
          leftover.push(input);
          continue;
        }

        if (!groups.has(value)) {
          groups.set(value, []);
        }

        groups.get(value)!.push(input);
      }

      const result: ResolvedInput[][] = [];

      for (const group of groups.values()) {
        const nestedGroups = groupInputs(group, remainingVars.slice(1));
        result.push(
          nestedGroups.reduce<ResolvedInput[]>(
            (acc, nestedGroup) => acc.concat(nestedGroup),
            [],
          ),
        );
      }

      if (leftover.length > 0) {
        const nestedGroups = groupInputs(leftover, remainingVars.slice(1));
        result.push(
          nestedGroups.reduce<ResolvedInput[]>(
            (acc, nestedGroup) => acc.concat(nestedGroup),
            [],
          ),
        );
      }

      return result;
    }

    const groupedInputs = groupInputs(resolved_inputs, vars);
    const joinResults = [];

    for (const group of groupedInputs) {
      const outputs = [
        ...new Set(
          group.map((input) =>
            fillTemplate(input.vars.output ?? "", input.vars),
          ),
        ),
      ];

      joinResults.push({
        response: {
          input_id: group[0].input_id,
          result: joinTexts(outputs, joinFormat),
        },
      });
    }
    return joinResults;

  } catch (error) {
    console.error("Error executing join processor:", error);

    return [
      {
        error: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

function splitText(resp: ResponseInfo, format?: string): string[] {
  const _escapeBraces = escapeBraces;

  // If format is newline separators, we can just split:
  if (format === "\n\n" || format === "\n")
    return resp.text
      .split(format)
      .map((s) => _escapeBraces(s.trim()))
      .filter((s) => s.length > 0);
  else if (format === ",")
    return processCSV(resp.text)
      .map((s) => _escapeBraces(s))
      .filter((s) => s.length > 0);

  // Other formatting rules require markdown parsing:
  // Parse string as markdown
  const md = fromMarkdown(resp.text);
  let results: string[] = [];

  const extract_md_blocks = (block_type: string) => {
    if (
      md?.children.length > 0 &&
      md.children.some((c) => c.type === block_type)
    ) {
      // Find the relevant block(s) that appear in the markdown text, at the root level:
      const md_blocks = md.children.filter((c) => c.type === block_type);
      for (const md_block of md_blocks) {
        if (block_type === "list") {
          // Extract the list items, flattening the ASTs to text
          const items = "children" in md_block ? md_block.children : [];
          for (const item of items) {
            const text = compileTextFromMdAST(item).trim();
            results.push(text);
          }
        } else if ("children" in md_block) {
          results.push(compileTextFromMdAST(md_block).trim());
        }
        if ("value" in md_block) results.push(md_block.value);
      }
    }
  };

  extract_md_blocks(format as any);
  results = results.filter((s) => s.length > 0).map(_escapeBraces);

  // NOTE: It is possible to have an empty [] results after split.
  // This happens if the splitter is a markdown separator, and none were found in the input(s).
  return results;
}

function joinTexts(texts: string[], format: JoinFormat): string {
  const escaped_texts = texts.map((t) => escapeBraces(t));

  if (format === JoinFormat.DubNewLine || format === JoinFormat.NewLine)
    return escaped_texts.join(format);
  else if (format === JoinFormat.DashedList)
    return escaped_texts.map((t) => "- " + t).join("\n");
  else if (format === JoinFormat.NumList)
    return escaped_texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  else if (format === JoinFormat.PyArr) return JSON.stringify(escaped_texts);

  console.error(`Could not join: Unknown formatting option: ${format}`);
  return escaped_texts[0];
}
