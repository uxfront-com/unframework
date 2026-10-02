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
import type { ElementNode, RenderNode } from "@unframework/ir";

import target from "../src/index.ts";

export const packageDir: string = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../../..", import.meta.url));
/** The toolchain directory the harness passes for Solid. */
export const toolchainDir: string = join(repo, "tests", "toolchains", "solid");
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

/** Emits one component through the Solid target and collects what it reports. */
export function emit(
  render: ElementNode,
  { name = "Fixture", kind = "default" }: { name?: string; kind?: "default" | "named" } = {},
): { files: OutputFile[]; reported: Omit<Diagnostic, "file" | "target">[] } {
  const component = createComponent(name, render, next());
  const module = createModule(`${name}.uf.tsx`, [component], [createExport(kind, name, next())]);
  const reported: Omit<Diagnostic, "file" | "target">[] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  return { files: target.emit(component, context), reported };
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
