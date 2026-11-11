// What a browser command knows about its caller: the project's provided target and harness
// context. Commands read them per call, so one set of commands serves every project of a run.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { caseReference, isReference } from "../harness.ts";
import type { HarnessContext } from "../harness.ts";
import type { ArtefactContext } from "./policy.ts";

/** The part of Vitest's `BrowserCommandContext` the commands read. */
export interface CommandProject {
  project: {
    name: string;
    getProvidedContext(): { target?: string; ufHarness?: HarnessContext };
  };
}

/** The calling project's target and harness context; throws if the project does not provide them. */
export function projectHarness(context: CommandProject): {
  target: string;
  harness: HarnessContext;
} {
  const provided = context.project.getProvidedContext();
  if (!provided.target || !provided.ufHarness) {
    throw new Error(
      `[uf] Project "${context.project.name}" does not provide "target" and "ufHarness": the harness's browser commands only run in harness projects.`,
    );
  }
  return { target: provided.target, harness: provided.ufHarness };
}

/** The case directory of a case id, refusing ids that are not known cases. */
export function caseDirectory(harness: HarnessContext, id: string): string {
  if (!Object.hasOwn(harness.cases, id) || id.split("/").includes("..")) {
    throw new Error(`[uf] Unknown case "${id}".`);
  }
  return join(harness.casesDir, id);
}

/**
 * The main `.uf.tsx` source of a case (absolute): the one its `case.json`'s `main` names,
 * relative to the case's directory and maybe outside it (ADR-0086), or else the directory's only
 * `.uf.tsx`. A spec mounts it, and the server render renders it.
 */
export function caseMainSource(harness: HarnessContext, id: string): string {
  const directory = caseDirectory(harness, id);
  const main = harness.cases[id]?.main;
  if (main !== undefined) {
    const source = resolve(directory, main);
    if (!main.endsWith(".uf.tsx") || !existsSync(source)) {
      throw new Error(`[uf] Case ${id} names ${main} as its main input, which it does not hold.`);
    }
    return source;
  }
  const sources = readdirSync(directory).filter((file) => file.endsWith(".uf.tsx"));
  if (sources.length !== 1) {
    throw new Error(
      `[uf] Case ${id} must hold one .uf.tsx input, or name its main one in case.json, to mount; found ${sources.length}.`,
    );
  }
  return join(directory, sources[0]!);
}

/** The directory artefact paths are shown relative to: the cases directory's parent. */
export function displayRoot(harness: HarnessContext): string {
  return dirname(harness.casesDir);
}

/**
 * How a target settles a case's artefacts every target shares (`__expected__/*`): the case's
 * reference (ADR-0057) writes them in update mode, everyone else compares.
 */
export function sharedArtefactContext(
  harness: HarnessContext,
  target: string,
  caseId: string,
): ArtefactContext {
  return {
    role: isReference(harness, target, caseId) ? "reference" : "follower",
    update: harness.update,
    root: displayRoot(harness),
    ledgerDir: harness.ledgerDir,
    reference: caseReference(harness, caseId),
  };
}
