// L14's thrown errors (ADR-0078): where a stack's top frame in a case must land.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { MapStackRequest, MapStackResult } from "@unframework/testing/node";
import type { ViteDevServer } from "vite";

import { CASES_DIR } from "./paths.ts";

/** Where a case throws: found in its source, never written in a test. */
export interface ThrowSite {
  file: string;
  line: number;
}

/** The one line of a case's `.uf.tsx` sources that holds `throw`. */
export function throwSite(caseDir: string): ThrowSite {
  const found = readdirSync(caseDir)
    .filter((file) => file.endsWith(".uf.tsx"))
    .flatMap((file) =>
      readFileSync(join(caseDir, file), "utf8")
        .split("\n")
        .flatMap((text, index) => (/\bthrow\b/.test(text) ? [{ file, line: index + 1 }] : [])),
    );
  if (found.length !== 1) {
    throw new Error(`${caseDir} holds ${found.length} throw statements: a case holds one.`);
  }
  return found[0]!;
}

/** One line of a V8 stack: where it ran, with or without the function's name around it. */
const FRAME = /^\s*at (?:.*\()?(.+?):(\d+):(\d+)\)?\s*$/;

/** A stack's frames, top first, as written. */
export function stackFrames(stack: string): { url: string; line: number; column: number }[] {
  return stack.split("\n").flatMap((text) => {
    const match = FRAME.exec(text);
    return match ? [{ url: match[1]!, line: Number(match[2]), column: Number(match[3]) }] : [];
  });
}

/**
 * Fails unless the top frame of a stack the module runner already mapped is the case's `throw`
 * (the `ssr` projects).
 */
export function checkMappedStack(caseDir: string, caseId: string, stack: string): void {
  const site = throwSite(caseDir);
  const expected = `${site.file}:${site.line}`;
  const frame = stackFrames(stack).find(({ url }) => url.includes(`/cases/${caseId}/`));
  const actual = frame && `${frame.url.split("/").pop()}:${frame.line}`;
  if (actual !== expected) {
    throw new Error(
      `The top frame in the case is ${actual ?? "missing"}, not ${expected}:\n${stack}`,
    );
  }
}

/** What the command reads of Vitest's context. */
export interface MapStackContext {
  project: { browser?: { vite?: ViteDevServer } };
}

/** `ufMapStack`: the top frame in the case, through the module graph's map of its module. */
export async function ufMapStack(
  context: MapStackContext,
  request: MapStackRequest,
): Promise<MapStackResult> {
  const graph = context.project.browser?.vite?.environments.client.moduleGraph;
  if (!graph) return { message: "The browser project has no Vite server to map the stack on." };
  const site = throwSite(join(CASES_DIR, request.case));
  const expected = `${site.file}:${site.line}`;
  const marker = `/cases/${request.case}/`;
  const frame = stackFrames(request.stack).find(({ url }) => url.includes(marker));
  if (!frame) {
    return {
      message: `No frame of the stack is in the case. Expected ${expected}:\n${request.stack}`,
    };
  }
  const { pathname, search } = new URL(frame.url);
  const module = await graph.getModuleByUrl(`${pathname}${search}`);
  const map = module?.transformResult?.map;
  if (!map || !("version" in map) || map.mappings === "") {
    return { message: `${frame.url} has no source map. Expected ${expected}.` };
  }
  const position = originalPositionFor(new TraceMap(map), {
    line: frame.line,
    column: frame.column - 1,
  });
  const file = position.source?.split("/").pop();
  const actual = `${file}:${position.line}`;
  return actual === expected
    ? {}
    : {
        message: `The top frame in the case maps to ${actual}, not to ${expected}: ${frame.url}:${frame.line}:${frame.column}.`,
      };
}
