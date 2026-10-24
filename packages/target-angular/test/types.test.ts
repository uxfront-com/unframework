// The type declarations an Angular component file keeps (`declaredTypes`), read from the parsed
// declaration: a header's type parameters may hold a `{` or an `=` of their own, and their
// constraints and defaults name types the file must keep (ADR-0068).
import { createTypeDeclaration, span } from "@unframework/ir";
import type { TypeDeclaration } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { declaredTypes, withoutUndefined } from "../src/types.ts";

function declaration(name: string, code: string, exported = false): TypeDeclaration {
  return createTypeDeclaration(name, exported, code, span(0, code.length));
}

const names = (declarations: readonly TypeDeclaration[]) => declarations.map(({ name }) => name);

describe("declaredTypes", () => {
  it("reads an interface whose type parameter's constraint is an object type", () => {
    const closure = [
      declaration("Label", 'type Label = "short" | "long";'),
      declaration(
        "ListProps",
        "interface ListProps<T extends { id: string }> { items: T[]; label: Label }",
        true,
      ),
    ];
    expect(names(declaredTypes(closure, []))).toEqual(["Label", "ListProps"]);
  });

  it("reads an alias whose type parameter has a default", () => {
    const closure = [
      declaration("Tone", 'type Tone = "info" | "danger";'),
      declaration("P", "type P<T = string> = { value: T; tone: Tone };"),
    ];
    expect(names(declaredTypes(closure, ["P"]))).toEqual(["Tone", "P"]);
    expect(withoutUndefined("P | undefined", closure)).toBe("P");
  });

  it("keeps what a type parameter's constraint and default, and an interface's base, name", () => {
    const closure = [
      declaration("Item", "interface Item { id: string }"),
      declaration("Fallback", "type Fallback = { id: number };"),
      declaration("Base", "interface Base { label: string }"),
      declaration("Unused", "type Unused = boolean;"),
      declaration(
        "ListProps",
        "interface ListProps<T extends Item, U = Fallback> extends Base { items: T[]; extra?: U }",
        true,
      ),
    ];
    expect(names(declaredTypes(closure, []))).toEqual(["Item", "Fallback", "Base", "ListProps"]);
  });

  it("leaves out a module type the declaration's own type parameter shadows", () => {
    const closure = [
      declaration("T", "type T = number;"),
      declaration("Box", "interface Box<T> { value: T }", true),
    ];
    expect(names(declaredTypes(closure, []))).toEqual(["Box"]);
  });
});
