import type { TypeShape } from "./types.ts";

export interface PrintOptions {
  /**
   * Sorts union members by their text and object members by name, so two adapters that order them differently print
   * the same text. The contract suite compares shapes this way.
   */
  canonical?: boolean;
}

/**
 * Prints a shape as a TypeScript type every target's type system accepts. An opaque node keeps
 * its text as written. An object reached again inside itself prints as its declaration's name.
 */
export function printShape(shape: TypeShape, options: PrintOptions = {}): string {
  const order = (items: string[]) => (options.canonical ? items.toSorted() : items);
  const print = (id: number, stack: readonly number[]): string => {
    const node = shape.nodes[id]!;
    const inner = (child: number) => print(child, [...stack, id]);
    // A union, a function or a readonly array or tuple binds looser than `[]` and `?`.
    const operand = (child: number) => {
      const node = shape.nodes[child]!;
      const text = inner(child);
      const loose =
        node.kind === "union" ||
        node.kind === "function" ||
        ((node.kind === "array" || node.kind === "tuple") && node.readonly);
      return loose ? `(${text})` : text;
    };
    switch (node.kind) {
      case "primitive":
        return node.name;
      case "literal":
        return typeof node.value === "string" ? JSON.stringify(node.value) : String(node.value);
      case "union":
        return order(node.types.map(operand)).join(" | ");
      case "array":
        return `${node.readonly ? "readonly " : ""}${operand(node.element)}[]`;
      case "tuple": {
        const elements = node.elements.map((element) => {
          if (element.name === undefined) {
            if (element.rest) return `...${inner(element.type)}`;
            return element.optional ? `${operand(element.type)}?` : inner(element.type);
          }
          const label = `${element.rest ? "..." : ""}${element.name}${element.optional ? "?" : ""}`;
          return `${label}: ${inner(element.type)}`;
        });
        return `${node.readonly ? "readonly " : ""}[${elements.join(", ")}]`;
      }
      case "object": {
        if (stack.includes(id)) return node.declaration?.name ?? "unknown";
        if (!node.members.length) return "{}";
        const members = options.canonical
          ? node.members.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          : node.members;
        const printed = members.map(
          (member) =>
            `${member.readonly ? "readonly " : ""}${key(member.name)}${member.optional ? "?" : ""}: ${inner(member.type)}`,
        );
        return `{ ${printed.join("; ")} }`;
      }
      case "function": {
        const parameters = node.parameters.map(
          (parameter) =>
            `${parameter.rest ? "..." : ""}${parameter.name}${parameter.optional ? "?" : ""}: ${inner(parameter.type)}`,
        );
        return `(${parameters.join(", ")}) => ${inner(node.returns)}`;
      }
      case "typeParameter":
        return node.name;
      case "opaque":
        return node.text;
    }
  };
  return print(shape.root, []);
}

function key(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}
