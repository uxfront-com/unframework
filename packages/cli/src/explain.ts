import { parseArgs } from "node:util";

import { docsUrl, lookup } from "@unframework/diagnostics";

import type { RunCommand } from "./command.ts";

export const run: RunCommand = async (args, io) => {
  const { positionals } = parseArgs({ args, allowPositionals: true });
  const [code] = positionals;
  if (code === undefined || positionals.length > 1) {
    throw new Error("It takes one diagnostic code, such as UF1002.");
  }
  const entry = lookup(code);
  if (!entry) throw new Error(`"${code}" is no diagnostic code.`);
  io.stdout(
    `${entry.code} ${entry.name} (${entry.severity})\n${entry.title}\n\n${entry.description}\n\n${docsUrl(entry.code)}\n`,
  );
  return 0;
};
