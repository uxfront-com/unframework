// L14's thrown errors in a project's tests (ADR-0078, ADR-0086): where the top frame of a stack
// in the case must land. The corpus's harness keeps a command of its own, which reads its cases'
// layout (`tests/integration/harness/thrown.ts`).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";
import type { ViteDevServer } from "vite";

import type { MapStackRequest, MapStackResult } from "../commands.ts";
import { caseDirectory, caseMainSource, projectHarness } from "./context.ts";
import type { CommandProject } from "./context.ts";

/** Where a case throws: found in its sources, never written in a test. */
export interface ThrowSite {
  /** The source (absolute). */
  file: string;
  line: number;
}

/**
 * The one line of a case's sources that holds `throw`: the `.uf.tsx` files of its directory and
 * its main source, wherever that lies. Throws unless there is exactly one.
 */
export function throwSite(sources: readonly string[]): ThrowSite {
  const found = [...new Set(sources)].flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .flatMap((text, index) => (/\bthrow\b/.test(text) ? [{ file, line: index + 1 }] : [])),
  );
  if (found.length !== 1) {
    throw new Error(
      `[uf] The case's sources hold ${found.length} throw statements: a case that throws on purpose holds one.`,
    );
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
 * The file a served module's URL stands for: Vite serves a file under the root at its path from
 * the root, and any other at `/@fs/<absolute path>`.
 */
export function servedFile(url: string, root: string): string | undefined {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
  return pathname.startsWith("/@fs/") ? pathname.slice("/@fs".length) : join(root, pathname);
}

/** What the command reads of Vitest's context. */
export interface MapStackContext extends CommandProject {
  project: CommandProject["project"] & { browser?: { vite?: ViteDevServer } };
}

/**
 * `ufMapStack`: maps the stack's top frame in the case's sources through the module graph's map
 * of its module, and says why it is not on the case's one `throw`, if it is not.
 */
export async function ufMapStack(
  context: MapStackContext,
  request: MapStackRequest,
): Promise<MapStackResult> {
  const vite = context.project.browser?.vite;
  const graph = vite?.environments.client.moduleGraph;
  if (!vite || !graph) {
    return { message: "The browser project has no Vite server to map the stack on." };
  }
  const { harness } = projectHarness(context);
  const directory = caseDirectory(harness, request.case);
  const main = caseMainSource(harness, request.case);
  const sources = [
    main,
    ...readdirSync(directory)
      .filter((file) => file.endsWith(".uf.tsx"))
      .map((file) => join(directory, file)),
  ].filter((file) => existsSync(file));
  const site = throwSite(sources);
  const name = (file: string) => file.split(sep).pop();
  const expected = `${name(site.file)}:${site.line}`;
  const directories = [...new Set(sources.map((file) => `${dirname(file)}${sep}`))];
  const frame = stackFrames(request.stack).find(({ url }) => {
    const file = servedFile(url, vite.config.root);
    return file !== undefined && directories.some((each) => file.startsWith(each));
  });
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
  const position = originalPositionFor(new TraceMap(JSON.stringify(map)), {
    line: frame.line,
    column: frame.column - 1,
  });
  const actual = `${position.source?.split("/").pop()}:${position.line}`;
  return actual === expected
    ? {}
    : {
        message: `The top frame in the case maps to ${actual}, not to ${expected}: ${frame.url}:${frame.line}:${frame.column}.`,
      };
}
