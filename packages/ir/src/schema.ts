import schema from "../schema/ir.schema.json" with { type: "json" };

/** A JSON Schema document (draft-07). */
export interface JsonSchema {
  $schema?: string;
  $ref?: string;
  definitions?: Record<string, unknown>;
  [keyword: string]: unknown;
}

/**
 * The JSON Schema of {@link UfModule}, generated from the IR's types.
 * Every IR snapshot in the corpus is validated against it.
 */
export const irSchema: JsonSchema = schema;
