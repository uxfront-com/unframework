// The server render comparison (L6, plus the render's console as L13), the one there is
// (ADR-0086): each case's SSR scenarios rendered twice with the target's own server renderer,
// normalised, and settled against the shared `__expected__/ssr.<scenario>.html`. Projects of
// `defineTestConfig` run the spec this package ships (`./spec.ts`), and the corpus's `ssr`
// projects run a spec of the harness's, which adds the corpus's skips and L14: both call
// `describeServerRender`. It imports each case's main source by its absolute path, so it runs the
// same from the workspace and from `node_modules`, and the import goes through the project's
// unplugin and the framework's own Vite plugin, as a user's would.
import { join } from "node:path";

import type { SsrRenderer } from "@unframework.dev/codegen";
import { beforeAll, describe, inject, it } from "vitest";

import { formatConsoleArgs } from "../browser/console.ts";
import { diffLines } from "../diff.ts";
import { ssrScenarios } from "../harness.ts";
import type { SsrCase } from "../harness.ts";
import { checkLayers, NOT_RENDERED_SKIP } from "../layers.ts";
import { sharedArtefactContext } from "../node/context.ts";
import { settleArtefact } from "../node/policy.ts";
import { isNormalizeTarget, normalizeHtml } from "../normalize/index.ts";

export type { SsrCase } from "../harness.ts";

/**
 * Declares the server render's tests for `cases`, in a `describe` titled `ssr [<target>]`, as
 * `describeTargets` titles its own. It reads the project's provided `target`, `ufHarness` and
 * `ufServer`, and throws in a project that lacks them.
 */
export function describeServerRender(cases: readonly SsrCase[]): void {
  const target = inject("target");
  // The normaliser removes only this target's framework noise, so it must know the target.
  if (!isNormalizeTarget(target)) {
    throw new Error(
      `The normaliser does not know the target "${target}": add its noise rules first.`,
    );
  }
  const harness = inject("ufHarness");
  const server = inject("ufServer");
  if (server === undefined) {
    throw new Error(
      `[uf] The ssr:${target} project provides no "ufServer": the server render runs only in an ssr project of the harness or of defineTestConfig.`,
    );
  }
  const loadRenderer = rendererOf(server);

  /**
   * Renders once, collecting console.warn and console.error into `messages` (the originals still
   * print). Tests in a file run one at a time, so patching the console is safe.
   */
  async function render(
    component: unknown,
    props: Record<string, unknown>,
    messages: string[],
  ): Promise<string> {
    const originals = { warn: console.warn, error: console.error };
    for (const level of ["warn", "error"] as const) {
      console[level] = (...args: unknown[]) => {
        messages.push(`console.${level}: ${formatConsoleArgs(args)}`);
        originals[level].apply(console, args);
      };
    }
    try {
      const html = await (await loadRenderer())(component, { props });
      if (typeof html !== "string")
        throw new Error(`The ${target} renderer returned ${typeof html}, not HTML.`);
      return html;
    } finally {
      console.warn = originals.warn;
      console.error = originals.error;
    }
  }

  // The target in the title, as `describeTargets` puts it: a report of every project tells the
  // seven runs apart.
  describe(`ssr [${target}]`, () => {
    // The renderer's cold start (the framework's server modules, through Vite) is the project's,
    // not the first case's: under load, every ssr and browser project at once, it can outlast a
    // test's timeout. A renderer that fails to load fails each case's L6 with the reason.
    beforeAll(async () => {
      await loadRenderer().catch(() => undefined);
    }, 300_000);

    for (const info of cases) {
      const config = harness.cases[info.id] ?? {};
      for (const [scenario, { props = {} }] of Object.entries(ssrScenarios(config))) {
        it(`${info.id} › ${scenario}`, async ({ task }) => {
          if (info.failure !== undefined) throw new Error(info.failure);
          const messages: string[] = [];
          let rendered = false;
          await checkLayers(
            task,
            { case: info.id, target, quarantine: harness.quarantine },
            {
              async L6() {
                if (info.skip !== undefined) return { skip: info.skip };
                const component = (
                  (await import(/* @vite-ignore */ info.source)) as { default: unknown }
                ).default;
                const first = await render(component, props, messages);
                const second = await render(component, props, messages);
                rendered = true;
                const html = normalizeHtml(first, { target });
                const again = normalizeHtml(second, { target });
                if (html !== again) {
                  throw new Error(
                    `Two renders of the same props differ:\n${diffLines(html, again)}`,
                  );
                }
                const outcome = settleArtefact(
                  join(info.dir, "__expected__", `ssr.${scenario}.html`),
                  html,
                  sharedArtefactContext(harness, target, info.id),
                );
                if (!outcome.pass) throw new Error(outcome.message);
              },
              L13: () => {
                if (!messages.length && !rendered) return { skip: info.skip ?? NOT_RENDERED_SKIP };
                if (messages.length) {
                  throw new Error(
                    `${messages.length} console message(s) during the server render:\n  ${messages.join("\n  ")}`,
                  );
                }
              },
            },
          );
        });
      }
    }
  });
}

/**
 * The target's renderer, imported once, on first use, through the project's Vite pipeline (one
 * framework copy).
 */
function rendererOf(server: string): () => Promise<SsrRenderer> {
  let renderer: Promise<SsrRenderer> | undefined;
  return () => {
    renderer ??= (
      import(/* @vite-ignore */ server) as Promise<{ renderToString?: SsrRenderer }>
    ).then((module) => {
      if (typeof module.renderToString !== "function") {
        throw new Error(`${server} does not export renderToString.`);
      }
      return module.renderToString;
    });
    return renderer;
  };
}
