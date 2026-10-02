// Generates schema/ir.schema.json from src/types.ts. `--check` fails instead of
// writing when the committed schema is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createGenerator } from "ts-json-schema-generator";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = `${root}schema/ir.schema.json`;

export function generateSchema(): string {
  const schema = createGenerator({
    path: `${root}src/types.ts`,
    tsconfig: `${root}tsconfig.json`,
    type: "UfModule",
    expose: "export",
    topRef: true,
    jsDoc: "extended",
    skipTypeCheck: true,
    additionalProperties: false,
    sortProps: true,
  }).createSchema("UfModule");
  schema.$id = "https://unframework.dev/schemas/ir-v1.json";
  return `${JSON.stringify(schema, null, 2)}\n`;
}

if (import.meta.main) {
  const schema = generateSchema();
  if (process.argv.includes("--check")) {
    if (readFileSync(output, "utf8") !== schema) {
      console.error(
        "schema/ir.schema.json is stale: run `pnpm --filter @unframework/ir generate`.",
      );
      process.exit(1);
    }
  } else {
    writeFileSync(output, schema);
    console.log(`Wrote ${output}`);
  }
}
