// The type declarations an Angular component file keeps (`declaredTypes`), read from the parsed
// declaration: a header's type parameters may hold a `{` or an `=` of their own, and their
// constraints and defaults name types the file must keep (ADR-0068).
import { createTypeDeclaration, span } from "@unframework/ir";
import type { TypeDeclaration } from "@unframework/ir";
import { describe, expect, it } from "vitest";

import { atConstraints, declaredTypes, withoutUndefined } from "../src/types.ts";

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

describe("atConstraints", () => {
  const parameter = (name: string, constraint?: string) => ({
    name,
    ...(constraint === undefined ? {} : { constraint: { code: constraint, span: span(0, 0) } }),
    span: span(0, 0),
  });

  it("reads each type parameter as its constraint, and one without as `any` (ADR-0068)", () => {
    const parameters = [parameter("T", "{ value: string }"), parameter("U")];
    expect(atConstraints("{ option: T; extra: U[] }", parameters)).toBe(
      "{ option: { value: string }; extra: any[] }",
    );
  });

  it("groups a constraint an operator or a suffix would bind into, and reads one through another", () => {
    const parameters = [parameter("T", '"a" | "b"'), parameter("U", "T")];
    expect(atConstraints("{ items: T[]; first: U }", parameters)).toBe(
      '{ items: ("a" | "b")[]; first: ("a" | "b") }',
    );
  });

  it("leaves a type without the parameters, and a reference with type arguments, as written", () => {
    expect(atConstraints("{ item: T }", [])).toBe("{ item: T }");
    expect(atConstraints("{ item: Box<T>; other: T.Member }", [parameter("Box")])).toBe(
      "{ item: Box<T>; other: T.Member }",
    );
  });

  it("leaves a name that a nested type declares for itself", () => {
    const parameters = [parameter("T", "{ id: string }"), parameter("K")];
    expect(atConstraints("{ render: <T>(x: T) => T; item: T }", parameters)).toBe(
      "{ render: <T>(x: T) => T; item: { id: string } }",
    );
    expect(atConstraints("{ m<T>(x: T): void; n: new <T>() => T }", parameters)).toBe(
      "{ m<T>(x: T): void; n: new <T>() => T }",
    );
    expect(atConstraints("{ [K in keyof T]: T[K] }", parameters)).toBe(
      "{ [K in keyof { id: string }]: { id: string }[K] }",
    );
    expect(atConstraints("T extends Array<infer K> ? K : K", parameters)).toBe(
      "{ id: string } extends Array<infer K> ? K : any",
    );
  });
});
