import { irSchema } from "./schema.ts";

/** A place where a value does not match the IR's schema. */
export interface IrValidationError {
  /** A JSON Pointer to the value, such as `/components/0/render/tag`; `""` for the root. */
  path: string;
  message: string;
}

// The keywords the schema generator emits. Validation throws on any other, so a generator
// change can never silently weaken the check; the tests compare the results with Ajv's.
const KEYWORDS: ReadonlySet<string> = new Set([
  "$id",
  "$ref",
  "$schema",
  "additionalProperties",
  "anyOf",
  "const",
  "definitions",
  "description",
  "enum",
  "items",
  "pattern",
  "properties",
  "required",
  "type",
]);

/** A node of the schema, in the keywords {@link KEYWORDS} lists. */
interface Schema {
  readonly $ref?: string;
  readonly type?: string;
  readonly const?: unknown;
  readonly enum?: readonly unknown[];
  readonly anyOf?: readonly Schema[];
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly items?: Schema;
  readonly pattern?: string;
}

// The generated schema, read through the keywords `check` verifies on every node it visits.
const root = irSchema as Schema & { definitions: Readonly<Record<string, Schema>> };

/**
 * Validates a value against {@link irSchema} and returns every mismatch: an empty list means
 * the value has the shape of a `UfModule`. The compiler checks what plugins return with it, so
 * a malformed module is reported against the plugin instead of crashing a target; then with
 * `checkInvariants`, for what the schema cannot express.
 *
 * A key whose value is `undefined` counts as absent, as it does in JSON (which drops it) and in
 * Ajv: a plugin that copies a node with `{ ...node, index: undefined }` hands the targets the
 * same module a JSON round trip of it would.
 */
export function validateModule(value: unknown): IrValidationError[] {
  const errors: IrValidationError[] = [];
  check(root, value, "", errors);
  return errors;
}

function check(schema: Schema, value: unknown, path: string, errors: IrValidationError[]): void {
  for (const keyword of Object.keys(schema)) {
    if (!KEYWORDS.has(keyword)) {
      throw new Error(`irSchema uses "${keyword}", which validateModule does not implement.`);
    }
  }
  if (schema.$ref !== undefined) check(resolve(schema.$ref), value, path, errors);
  if (schema.type !== undefined && !hasType(value, schema.type)) {
    errors.push({ path, message: `must be ${schema.type}` });
    return;
  }
  if ("const" in schema && value !== schema.const) {
    errors.push({ path, message: `must be ${JSON.stringify(schema.const)}` });
  }
  // A pattern is an ECMA-262 regular expression that constrains strings only.
  if (
    schema.pattern !== undefined &&
    typeof value === "string" &&
    !new RegExp(schema.pattern, "u").test(value)
  ) {
    errors.push({ path, message: `must match ${schema.pattern}` });
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push({ path, message: `must be one of ${JSON.stringify(schema.enum)}` });
  }
  if (schema.anyOf) checkAnyOf(schema.anyOf, value, path, errors);
  if (isRecord(value) && schema.properties) {
    // Own properties only, on both sides: IR is JSON data, and a key such as `constructor`
    // must not find a schema, or a value, on a prototype.
    for (const key of schema.required ?? []) {
      if (!isPresent(value, key)) errors.push({ path, message: `must have "${key}"` });
    }
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      const property = Object.hasOwn(schema.properties, key) ? schema.properties[key] : undefined;
      if (property) check(property, item, `${path}/${key}`, errors);
      else if (schema.additionalProperties === false) {
        errors.push({ path, message: `must not have "${key}"` });
      }
    }
  }
  if (Array.isArray(value) && schema.items) {
    // By index, as Ajv does: a hole in a sparse array is checked as `undefined`, where
    // `forEach` would skip it and hand the targets an array with a missing node.
    for (const [index, item] of (value as unknown[]).entries()) {
      check(schema.items, item, `${path}/${index}`, errors);
    }
  }
}

function matches(schema: Schema, value: unknown, path: string): boolean {
  const errors: IrValidationError[] = [];
  check(schema, value, path, errors);
  return errors.length === 0;
}

/**
 * Checks a value against a union. A branch that requires a constant `kind` can only match a
 * node of that kind, so the others are not checked: checking them in full would give the same
 * answer after descending into every property both kinds share, and a node whose kind comes
 * late in its union would pay for the earlier branches at every level of nesting (exponential
 * in the depth). When the node's kind picks one branch, its own errors are the union's, which
 * say where the node is wrong; otherwise the union reports that nothing matched.
 */
function checkAnyOf(
  branches: readonly Schema[],
  value: unknown,
  path: string,
  errors: IrValidationError[],
): void {
  const kind = isRecord(value) && isPresent(value, "kind") ? value.kind : undefined;
  const candidates = branches.filter((branch) => {
    const required = requiredKind(branch);
    return required === undefined || (kind !== undefined && required.const === kind);
  });
  const [only] = candidates;
  if (candidates.length === 1 && kind !== undefined && requiredKind(only!) !== undefined) {
    check(only!, value, path, errors);
    return;
  }
  if (candidates.some((branch) => matches(branch, value, path))) return;
  const names = branches.map((branch) => branch.$ref?.split("/").at(-1) ?? "a schema");
  errors.push({ path, message: `must match one of ${names.join(", ")}` });
}

/** The constant `kind` a branch requires, as `{ const }`, or `undefined` when it has none. */
function requiredKind(branch: Schema): { const: unknown } | undefined {
  const target = branch.$ref === undefined ? branch : resolve(branch.$ref);
  const kind =
    target.properties && Object.hasOwn(target.properties, "kind")
      ? target.properties.kind
      : undefined;
  if (!kind || !("const" in kind) || !target.required?.includes("kind")) return undefined;
  return { const: kind.const };
}

/** Whether an object has a key with a value: a key set to `undefined` is absent, as in JSON. */
function isPresent(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key) && value[key] !== undefined;
}

function resolve(ref: string): Schema {
  const name = ref.startsWith("#/definitions/") ? ref.slice("#/definitions/".length) : undefined;
  const target = name === undefined ? undefined : root.definitions[name];
  if (!target) throw new Error(`irSchema has no definition for "${ref}".`);
  return target;
}

function hasType(value: unknown, type: string): boolean {
  switch (type) {
    case "array":
      return Array.isArray(value);
    case "boolean":
      return typeof value === "boolean";
    case "number":
      // JSON has no NaN or Infinity, so neither is a valid IR number.
      return typeof value === "number" && Number.isFinite(value);
    case "object":
      return isRecord(value);
    case "string":
      return typeof value === "string";
    default:
      throw new Error(
        `irSchema uses the type ${JSON.stringify(type)}, which validateModule does not implement.`,
      );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
