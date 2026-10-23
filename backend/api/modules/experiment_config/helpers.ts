import { ResolvedInput } from "./types";
import * as crypto from "crypto";


export function cartesianProduct(arrays: ResolvedInput[][]): ResolvedInput[] {
  if (arrays.length === 0) return [];

  return arrays.reduce<ResolvedInput[]>(
    (acc, curr) => {
      const result: ResolvedInput[] = [];
      for (const a of acc) {
        for (const b of curr) {
          result.push({
            // Keep the dataset input id
            input_id: b.input_id ?? a.input_id,
            // Merge all variables
            vars: {
              ...a.vars,
              ...b.vars,
            },
          });
        }
      }
      return result;
    },
    [{ input_id: 0, vars: {} }],
  );
}

export function computeMarkerValueHash(marker_id: number, value: string): string {
  return crypto
    .createHash("sha256")
    .update(`${marker_id}${value}`)
    .digest("hex");
}
