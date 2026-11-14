// The hydrate projects' mount (L12, ADR-0095): `mount` and `mountScenario` render the case's main
// component on the server, through the `ufHydrationRender` command, put that HTML in the root and
// hydrate it with the target's hydrate adapter, in place of a client render. Everything after
// that is the same: settle, steps, traces, rerender and unmount. Every check a spec runs is
// recorded as L12 (`recordEveryLayerAs`), and the mount adds L12's own sub-checks, each named in
// its failure:
//   mismatch          the framework's own signal, during hydration and at every later settle
//   ids               the raw id values, in document order, are the server's
//   DOM               the hydrated root equals the scenario's `__expected__/dom.<name>.html`
//   client agreement  the hydrated root equals the same target's client render of the props
import type {
  HydratedComponent,
  MountAdapter,
  MountEvent,
  MountOptions,
} from "@unframework.dev/codegen";
import { assertSerialisableProps } from "@unframework.dev/codegen/toolchain-browser";
import { inject, TestRunner } from "vitest";
import type { RunnerTestCase } from "vitest";
import { commands } from "vitest/browser";

import "../commands.ts";
import { diffLines } from "../diff.ts";
import { formatError } from "../errors.ts";
import { caseOfFile } from "../harness.ts";
import { recordLayer } from "../layers.ts";
import { captureExternalConsole } from "./console.ts";
import { ROOT_ATTRIBUTE, settleFrame } from "./determinism.ts";

/** Whether this project hydrates (`test.provide.ufHydrate`). */
export function isHydrateProject(): boolean {
  return (inject("ufHydrate") as boolean | undefined) === true;
}

/** The attributes whose values are ids, or lists of ids, that the `ids` sub-check reads. */
export const ID_ATTRIBUTES: readonly string[] = [
  "id",
  "for",
  "headers",
  "list",
  "aria-labelledby",
  "aria-describedby",
  "aria-controls",
  "aria-owns",
  "aria-activedescendant",
  "aria-details",
  "aria-errormessage",
  "aria-flowto",
];

/**
 * Every id attribute under `root`, in document order, as `name="value"`, with its raw value:
 * the DOM check renames generated ids, so it cannot see an id that hydration changed (ADR-0095).
 * A `<script>`'s are left out: a framework's hydration data (Angular's `ng-state`) is one its
 * adapter takes out of the page as it hydrates.
 */
export function idsOf(root: ParentNode): string[] {
  const ids: string[] = [];
  for (const element of root.querySelectorAll("*")) {
    if (element.localName === "script") continue;
    for (const name of ID_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value !== null) ids.push(`${name}="${value}"`);
    }
  }
  return ids;
}

/** The ids of server HTML, read as the page parses it. */
export function idsOfHtml(html: string): string[] {
  const template = document.createElement("template");
  template.innerHTML = html;
  return idsOf(template.content);
}

/** Why two lists of ids differ, or nothing when they are the same. */
export function compareIds(
  server: readonly string[],
  hydrated: readonly string[],
): string | undefined {
  if (server.length === hydrated.length && server.every((id, index) => id === hydrated[index])) {
    return undefined;
  }
  const lines = [
    "the hydrated DOM's ids are not the server's:",
    `  server:   ${server.join(" ") || "(none)"}`,
    `  hydrated: ${hydrated.join(" ") || "(none)"}`,
  ];
  return lines.join("\n");
}

/** Records an L12 failure on the current test, naming its sub-check. */
export function failHydration(target: string, subCheck: string, message: string): void {
  const test = TestRunner.getCurrentTest<RunnerTestCase | undefined>();
  if (!test) throw new Error(`${subCheck}: ${message}`);
  const harness = inject("ufHarness");
  recordLayer(
    test,
    { case: caseOfFile(test.file.filepath, harness), target, quarantine: harness.quarantine },
    "L12",
    { status: "fail", message: `${subCheck}: ${message}` },
  );
}

/** What `hydrateInto` hydrated: the component, and the server HTML it started from. */
export interface Hydrated {
  instance: HydratedComponent;
  html: string;
}

/**
 * Renders the case's main component on the server with the mount's props and hydrates that HTML
 * in `container`. A spec that mounts anything but its case's main component fails here, loudly:
 * the server renders that one, never something else. A hydrate adapter that throws is a
 * framework that could not hydrate the server's HTML (Angular's NG0500, Solid's "Hydration
 * Mismatch", Svelte's `hydration_failed`): that is L12's `mismatch`, and the mount fails with it.
 */
export async function hydrateInto(
  target: string,
  hydrate: (
    component: unknown,
    container: HTMLElement,
    html: string,
    options: MountOptions,
  ) => Promise<HydratedComponent>,
  caseId: string,
  component: unknown,
  container: HTMLElement,
  options: MountOptions,
): Promise<Hydrated> {
  const props = { ...options.props };
  assertSerialisableProps(props, "A hydrate project renders the server HTML in Node (L12)");
  const rendered = await commands.ufHydrationRender({ case: caseId, props });
  if (rendered.console.length) captureExternalConsole(rendered.console);
  const main = (await importModule(rendered.module)) as { default?: unknown };
  if (main.default !== component) {
    throw new Error(
      `mount: a hydrate project hydrates the server render of ${caseId}'s main component, ${rendered.module}, and this spec mounted something else. Mount the case's main component (case.json's "main"), or move the spec's other component into a case of its own (ADR-0095).`,
    );
  }
  try {
    return {
      instance: await hydrate(component, container, rendered.html, options),
      html: rendered.html,
    };
  } catch (error) {
    failHydration(target, "mismatch", `the framework could not hydrate: ${formatError(error)}`);
    throw error;
  }
}

/**
 * Imports a module by the URL the spec's own import of it has, so it is the same module: Vite
 * rewrites a dynamic `import()` of a computed URL to add `?import`, which the page loads as a
 * module of its own.
 */
const importModule = new Function("url", "return import(url);") as (
  url: string,
) => Promise<unknown>;

/** The rounds of settling the client render gets before it counts as never quiet. */
const CLIENT_SETTLE_ROUNDS = 10;

/**
 * The same target's client render of the component with the props, normalised as L7 normalises
 * the hydrated root, in a second root beside it: mounted with the mount adapter, settled until
 * quiet, read, then unmounted and removed. Its listeners drop what it emits. The root sits in a
 * `<form>` of its own, so its radios are a group apart from the hydrated root's: two radios of
 * one `name` with no form are one group in the page, and checking the client render's would
 * uncheck the hydrated one's.
 */
export async function clientRender(
  mount: MountAdapter,
  component: unknown,
  props: Readonly<Record<string, unknown>> | undefined,
  events: readonly MountEvent[],
  normalize: (root: HTMLElement) => string,
): Promise<string> {
  const form = document.createElement("form");
  const root = document.createElement("div");
  root.setAttribute(ROOT_ATTRIBUTE, "");
  root.setAttribute("data-testid", "uf-client-agreement");
  form.append(root);
  document.body.append(form);
  try {
    const on = Object.fromEntries(events.map(({ name }) => [name, () => {}]));
    const instance = await mount(component, root, { ...(props ? { props } : {}), on, events });
    try {
      let previous: string | undefined;
      for (let round = 0; round < CLIENT_SETTLE_ROUNDS; round += 1) {
        await settleFrame(() => instance.settle());
        const html = normalize(root);
        if (html === previous) return html;
        previous = html;
      }
      throw new Error(
        `the client render did not settle: its DOM still changed after ${CLIENT_SETTLE_ROUNDS} rounds.`,
      );
    } finally {
      await instance.unmount();
    }
  } finally {
    form.remove();
  }
}

/** Why the hydrated root and the client render differ, or nothing when they agree. */
export function compareClientRender(hydrated: string, client: string): string | undefined {
  if (hydrated === client) return undefined;
  return `the hydrated DOM is not the client render's (expected: the client render, actual: the hydrated root):\n${diffLines(client, hydrated)}`;
}
