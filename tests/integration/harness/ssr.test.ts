// The ssr projects (L6, plus the render's console as L13): every case's SSR scenarios rendered
// with the target's own server renderer and compared, normalised, with the shared
// `__expected__/ssr.<scenario>.html`. Components are imported through `import.meta.glob`, so each
// one goes through the unplugin and the framework's own Vite plugin, like a user's would.
import { basename, join } from "node:path";

import type { SsrRenderer } from "@unframework/codegen";
import {
  checkLayers,
  diffLines,
  formatConsoleArgs,
  settleArtefact,
  sharedArtefactContext,
  ssrScenarios,
} from "@unframework/testing/node";
import { isNormalizeTarget, normalizeHtml } from "@unframework/testing/normalize";
import { beforeAll, describe, inject, it } from "vitest";

import { errorState, listCases } from "./cases.ts";
import "./context.ts";

const target = inject("target");
// The normaliser removes only this target's framework noise, so it must know the target.
if (!isNormalizeTarget(target)) {
  throw new Error(
    `The normaliser does not know the target "${target}": add its noise rules first.`,
  );
}
const harness = inject("ufHarness");
const server = inject("ufServer");
const cases = listCases(harness.casesDir);
const components = import.meta.glob<{ default: unknown }>("../cases/**/*.uf.tsx");

let renderer: Promise<SsrRenderer> | undefined;
/** The target's renderer, imported through this project's Vite pipeline (one framework copy). */
function loadRenderer(): Promise<SsrRenderer> {
  renderer ??= (
    import(/* @vite-ignore */ server) as Promise<{ renderToString?: SsrRenderer }>
  ).then((module) => {
    if (typeof module.renderToString !== "function") {
      throw new Error(`${server} does not export renderToString.`);
    }
    return module.renderToString;
  });
  return renderer;
}

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

describe(`ssr:${target}`, () => {
  // The renderer's cold start (the framework's server modules, through Vite) is the project's,
  // not the first case's: under a canary's load, every ssr and browser project at once, it can
  // outlast a test's timeout. A renderer that fails to load fails each case's L6 with the reason.
  beforeAll(async () => {
    await loadRenderer().catch(() => undefined);
  }, 300_000);

  for (const info of cases) {
    const errors = errorState(info, target);
    // A case with compile errors has no output: the compile project records L6 as skipped.
    if (errors === true) continue;
    const key = `../cases/${info.id}/${basename(info.source)}`;
    for (const [scenario, { props = {} }] of Object.entries(ssrScenarios(info.config))) {
      it(`${info.id} › ${scenario}`, async ({ task }) => {
        if (errors instanceof Error) throw errors;
        const messages: string[] = [];
        let rendered = false;
        await checkLayers(
          task,
          { case: info.id, target, quarantine: harness.quarantine },
          {
            async L6() {
              const load = components[key];
              if (!load) throw new Error(`import.meta.glob did not find ${key}.`);
              const component = (await load()).default;
              const first = await render(component, props, messages);
              const second = await render(component, props, messages);
              rendered = true;
              const html = normalizeHtml(first, { target });
              const again = normalizeHtml(second, { target });
              if (html !== again) {
                throw new Error(`Two renders of the same props differ:\n${diffLines(html, again)}`);
              }
              const outcome = settleArtefact(
                join(info.dir, "__expected__", `ssr.${scenario}.html`),
                html,
                sharedArtefactContext(harness, target),
              );
              if (!outcome.pass) throw new Error(outcome.message);
            },
            L13: () => {
              if (!messages.length && !rendered)
                return { skip: "the component did not render (L6)" };
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
