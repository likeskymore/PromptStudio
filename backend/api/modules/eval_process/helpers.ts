import { PromptVarsDict } from "../experiment_config/types";
import { Dict, ResponseInfo } from "../LLM/types";
import { Result } from "../result/types";
import { fromMarkdown } from "mdast-util-from-markdown";
import { compileTextFromMdAST, processCSV } from "../../ChainForgeUtils/utils";
import { JoinFormat } from "./types";

/**
 * Given a string, returns the same string with the \ before any braces \{ and \} removed. Does nothing else.
 * @param str The string to transform
 */
export function cleanEscapedBraces(str: string): string {
  return str.replace("\\{", "{").replace("\\}", "}");
}

/**
 * Given a string, returns the same string with braces { and } escaped, \{ and \}. Does nothing else.
 * @param str The string to transform
 */
function escapeBraces(str: string): string {
  return str.replace(/[{}]/g, "\\$&");
}

/**
 * Runs the provided process function over the response information.
 * @param process_func - A function that takes a ResponseInfo object and returns a processed result.
 * @param result - The result object containing the output result and ID.
 * @param vars - A dictionary of prompt variables.
 * @param metavars - A dictionary of metadata variables.
 * @param llm_name - The name of the LLM used for processing.
 * @param prompt - The prompt string used in the evaluation or processing.
 * @param format - Optional output format passed as the second argument to the process function.
 */
export async function run_over_response(
  process_func: (resp: ResponseInfo, format?: string) => any,
  result: Result,
  vars: PromptVarsDict,
  metavars: Dict,
  llm_name: string,
  prompt: string,
  format: string | undefined,
): Promise<{ result_id: number; result?: any; error?: string }> {
  const r_info = new ResponseInfo(
    cleanEscapedBraces(result.output_result),
    prompt,
    vars,
    metavars || {},
    llm_name,
  );

  try {
    let processed = process_func(r_info, format);
    if (processed && typeof processed.then === "function") {
      processed = await processed;
    }

    return { result_id: result.id, result: processed };
  } catch (err) {
    return {
      result_id: result.id,
      error: (err as Error).message,
    };
  }
}

export function splitText(resp: ResponseInfo, format?: string): string[] {
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

export function joinTexts(texts: string[], format: JoinFormat): string {
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
