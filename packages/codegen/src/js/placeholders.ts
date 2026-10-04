import type * as AST from "@oxc-project/types";

import { parenthesesNeeded, parseExpressionSource } from "../rewrite.ts";
import type { ParenthesesSlot } from "../rewrite.ts";

const at = { start: 0, end: 0 } as const;

interface Slot {
  /** The placeholder node: its name is set on each attempt to print. */
  node: { name: string };
  /** The code it stands for, parenthesised where needed. */
  code: string;
}

/**
 * Source text in printed code (design §4.1, §4.2). oxc-codegen re-prints what it is given: it
 * writes numbers from their value (`1000` → `1e3`), drops comments and adds no parentheses
 * around text it is told is an identifier. So expressions and types copied from the source
 * enter an AST as placeholder identifiers, and {@link Placeholders.print} replaces each with
 * its code once the module is printed: the code stays as the author wrote it, parenthesised
 * where its slot needs it.
 *
 * Use each placeholder node once. A placeholder's name is chosen when printing, so that no
 * text of the output (a string, a copied declaration) can be mistaken for one.
 */
export class Placeholders {
  readonly #slots: Slot[] = [];

  /**
   * An expression slot holding `code`, which must be exactly one expression (it is parsed to
   * check that: anything else throws, as a compiler bug). It is wrapped in parentheses when
   * `slot` needs them (`argument` by default: see `ParenthesesSlot`), and a trailing line
   * comment gets a line break so it cannot swallow what follows.
   */
  expression(code: string, slot: ParenthesesSlot = "argument"): AST.IdentifierReference {
    const { expression, comments } = parseExpressionSource(code);
    let text = code;
    if (comments.some((comment) => comment.type === "Line" && comment.end === code.length)) {
      text = `${text}\n`;
    }
    if (parenthesesNeeded(expression, code, slot)) text = `(${text})`;
    return this.#add(text) as AST.IdentifierReference;
  }

  /**
   * A type slot holding a type as the source writes it (a props annotation, an inline object
   * type), in a position that takes any type: an annotation or a type argument.
   */
  type(code: string): AST.TSTypeReference {
    return {
      type: "TSTypeReference",
      typeName: this.#add(code) as AST.IdentifierReference,
      typeArguments: null,
      ...at,
    } as AST.TSTypeReference;
  }

  #add(code: string): AST.IdentifierReference {
    const node = { type: "Identifier", name: "", ...at } as AST.IdentifierReference;
    this.#slots.push({ node, code });
    return node;
  }

  /** How many placeholders there are. */
  get size(): number {
    return this.#slots.length;
  }

  /**
   * Runs `print`, which prints an AST holding these placeholders, and returns its output with
   * each placeholder replaced by its code. A placeholder is named `$uf<n>$<index>$`; when the
   * output holds the prefix `$uf<n>$` anywhere else (a string that happens to spell one), the
   * next `n` is tried, so the result is deterministic. Throws when a placeholder is missing
   * from the output or printed twice: a target bug.
   */
  print(print: () => string): string {
    const count = this.#slots.length;
    const printed = (): string => {
      const output = print();
      if (this.#slots.length !== count) {
        throw new Error("Placeholders were made while printing: build the AST first.");
      }
      return output;
    };
    if (count === 0) return printed();
    // Each prefix the output's own text spells takes one of its `$uf`s beside the
    // placeholders', so a free prefix turns up within that many attempts; past them, a
    // placeholder was printed twice.
    let attempts = Infinity;
    for (let attempt = 0; ; attempt++) {
      const prefix = `$uf${attempt}$`;
      for (const [index, { node }] of this.#slots.entries()) node.name = `${prefix}${index}$`;
      const output = printed();
      if (attempts === Infinity) attempts = output.split("$uf").length - 1 - count;
      const found = locate(output, prefix, this.#slots.length);
      if (found === "collision" && attempt < attempts) continue;
      if (found === "collision") {
        throw new Error("A placeholder was printed twice: use each placeholder node once.");
      }
      if (typeof found === "string") throw new Error(found);
      let result = "";
      let last = 0;
      for (const { index, start, end } of found) {
        result += output.slice(last, start) + this.#slots[index]!.code;
        last = end;
      }
      return result + output.slice(last);
    }
  }
}

interface Occurrence {
  index: number;
  start: number;
  end: number;
}

/**
 * Finds every placeholder in `output`, in order. Returns `"collision"` when the prefix
 * appears anywhere but in exactly one placeholder each (the output's own text spells it), or
 * a message when a placeholder is missing.
 */
function locate(output: string, prefix: string, count: number): Occurrence[] | string {
  const found: Occurrence[] = [];
  const seen = new Set<number>();
  for (let start = output.indexOf(prefix); start >= 0; start = output.indexOf(prefix, start + 1)) {
    const match = /^(\d+)\$/.exec(output.slice(start + prefix.length));
    const index = match ? Number(match[1]) : -1;
    if (!match || index >= count || seen.has(index)) return "collision";
    seen.add(index);
    found.push({ index, start, end: start + prefix.length + match[0].length });
  }
  if (found.length !== count) {
    const missing = Array.from({ length: count }, (_, index) => index).filter((i) => !seen.has(i));
    return `Placeholders ${missing.join(", ")} were not printed: each placeholder node must be in the printed AST once.`;
  }
  return found;
}
