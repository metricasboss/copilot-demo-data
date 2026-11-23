import type { Row } from "./simulate.ts";

function cell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** CSV com cabeçalho sempre (mesmo com zero linhas), colunas na ordem dada. */
export function toCsv(columns: readonly string[], rows: Row[]): string {
  const lines = [columns.join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c])).join(","));
  return lines.join("\n") + "\n";
}

export function toNdjson(rows: Row[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "");
}
