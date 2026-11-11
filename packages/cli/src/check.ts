import { parseArgs } from "node:util";

import { formatDiagnostics, toJsonDiagnostics, toSarif } from "@unframework.dev/diagnostics";

import type { RunCommand } from "./command.ts";
import { compileSources, printable, TYPE_ORACLE_OPTION } from "./compilation.ts";

const FORMATS = ["pretty", "json", "sarif"];

export const run: RunCommand = async (args, io) => {
  const { values } = parseArgs({
    args,
    options: { format: { type: "string", default: "pretty" }, ...TYPE_ORACLE_OPTION },
  });
  if (!FORMATS.includes(values.format)) {
    throw new Error(`--format takes pretty, json or sarif, not "${values.format}".`);
  }
  const { status, diagnostics, sources } = await compileSources(io, values["type-oracle"]);
  if (values.format === "json") {
    io.stdout(`${JSON.stringify(toJsonDiagnostics(diagnostics, sources), null, 2)}\n`);
  } else if (values.format === "sarif") {
    io.stdout(`${JSON.stringify(toSarif(diagnostics, sources), null, 2)}\n`);
  } else {
    io.stdout(printable(formatDiagnostics(diagnostics, sources)));
  }
  return status;
};
