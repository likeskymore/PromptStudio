import type { Root, RootContent } from "mdast";

export const processCSV = (csv: string): string[] => {
  const matches = csv.match(/(\s*"[^"]+"\s*|\s*[^,]+|,)(?=,|$)/g);
  if (!matches) return [csv];
  for (let index = 0; index < matches.length; index += 1) {
    matches[index] = matches[index].trim();
    if (matches[index] === ",") matches[index] = "";
  }
  return matches.map((value) => value.trim()).filter((value) => value.length > 0);
};

export function compileTextFromMdAST(md: Root | RootContent): string {
  if (md === undefined) return "";
  if ("value" in md) return typeof md.value === "string" ? md.value : "";
  if ("children" in md && md.children?.length > 0) {
    return md.children.map(compileTextFromMdAST).join("");
  }
  return "";
}
