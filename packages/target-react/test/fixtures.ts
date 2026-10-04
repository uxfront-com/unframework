import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Diagnostic, EmitContext, OutputFile, ToolchainFile } from "@unframework/codegen";
import {
  createComponent,
  createElement,
  createExport,
  createModule,
  createStaticAttribute,
  createText,
} from "@unframework/ir";
import type { ElementNode, RenderNode, UfModule } from "@unframework/ir";

// The analyser lowers the M1 fixtures from source, so each shape under test is one it produces
// (and keeps the IR's invariants). A test-only import: the target itself never sees the analyser.
import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
/** The toolchain directory the harness passes for React. */
export const toolchainDir: string = join(repo, "tests", "toolchains", "react");
const cases = join(repo, "tests", "integration", "cases");

let offset = 0;
/** A distinct span per node, so a test can tell which attribute a diagnostic points at. */
const next = () => ({ start: offset, end: ++offset });

/** An element, with attributes in the order given and text children as strings. */
export function el(
  tag: string,
  attributes: Record<string, string | true> = {},
  ...children: (RenderNode | string)[]
): ElementNode {
  return createElement(
    tag,
    Object.entries(attributes).map(([name, value]) => createStaticAttribute(name, value, next())),
    children.map((child) => (typeof child === "string" ? createText(child, next()) : child)),
    next(),
  );
}

/** `basics/hello`, as the analyser lowers it. */
export const hello = (): ElementNode => el("p", { class: "greeting" }, "Hello, world!");

/** `basics/nested-and-void`, as the analyser lowers it. */
export const profileCard = (): ElementNode =>
  el(
    "article",
    { class: "profile", "aria-labelledby": "profile-name" },
    el(
      "header",
      { class: "profile-header" },
      el("img", {
        src: AVATAR,
        alt: "Ada's avatar",
        width: "48",
        height: "48",
      }),
      el("h2", { id: "profile-name" }, "Ada Lovelace"),
    ),
    el("p", {}, "Mathematician & writer", el("br"), "of the first published program"),
    el("hr"),
    el("label", { for: "profile-note" }, "Note"),
    el("input", { id: "profile-note", type: "text", name: "note", placeholder: "Say hello" }),
  );

export const AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E";

/** What the React target emitted for one component, and what it reported (never anything). */
export interface Emitted {
  files: OutputFile[];
  reported: Omit<Diagnostic, "file" | "target">[];
}

/** Emits one component of a module through the React target and collects what it reports. */
export function emitComponent(
  module: UfModule,
  name: string = module.components[0]!.name,
): Emitted {
  const component = module.components.find((candidate) => candidate.name === name)!;
  const reported: Emitted["reported"] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  return { files: target.emit(component, context), reported };
}

/** Emits a static render tree as one component's, the way M0's fixtures were built. */
export function emit(
  render: ElementNode,
  { name = "Fixture", kind = "default" }: { name?: string; kind?: "default" | "named" } = {},
): Emitted {
  const component = createComponent(name, render, next());
  return emitComponent(
    createModule(`${name}.uf.tsx`, [component], [createExport(kind, name, next())]),
  );
}

/**
 * Lowers a `.uf.tsx` source with the analyser, which must accept it without a diagnostic: a
 * fixture the analyser rejects tests nothing the compiler would emit.
 */
export function lower(source: string, file = "Fixture.uf.tsx"): UfModule {
  const { module, diagnostics } = analyze(parseModule(file, source));
  if (!module || diagnostics.length) {
    const messages = diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
    throw new Error(`The analyser rejected the fixture:\n${messages.join("\n")}`);
  }
  return module;
}

/** Every committed golden output of a target, read from the integration corpus. */
export function goldens(targetName: string): ToolchainFile[] {
  const pattern = new RegExp(`(?:^|/)__output__/${targetName}/[^/]+$`);
  return readdirSync(cases, { recursive: true })
    .map((entry) => String(entry).split("\\").join("/"))
    .filter((entry) => pattern.test(entry))
    .toSorted()
    .map((entry) => {
      const path = join(cases, entry);
      return { path, contents: readFileSync(path, "utf8") };
    });
}
