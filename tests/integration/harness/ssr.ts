// The ssr projects (L6, plus the render's console as L13): every case's SSR scenarios, through
// the testing package's one server render comparison (`describeServerRender`, ADR-0086), with
// the corpus's extras decided as the file is collected, after the compile project has written
// the expected diagnostics in an update run: a case with compile errors has no output and is left
// out, a case whose expected diagnostics are missing fails, a case whose every test requires a
// capability the target lacks is skipped (`ssr-skip.ts`), and a project the run adds as some
// case's reference renders those cases alone (ADR-0057). L14's deliberate throws are the
// corpus's alone (`ssrThrows`, ADR-0078).
//
// A project's renders run as shard files (`ssr.<k>.test.ts`, ADR-0093), each one call of
// `describeSsrShard` with its index, which takes its share of the cases by position (`shardOf`),
// so Vitest renders them in parallel. The project provides how many shards it runs
// (`ufSsrShards`, `ssrShardCount`), and runs the first ones of the files on disk: four for
// Angular, whose renders wait on ngtsc, and one for every other target (`SSR_SHARDS`).
import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { builtinTargets } from "@unframework.dev/compiler";
import type { TargetName } from "@unframework.dev/compiler";
import { checkLayers } from "@unframework.dev/testing/node";
import { describeServerRender } from "@unframework.dev/testing/ssr";
import type { SsrCase } from "@unframework.dev/testing/ssr";
import { describe, inject, it } from "vitest";

import { errorState, listCases, specTests } from "./cases.ts";
import type { CaseInfo } from "./cases.ts";
import { onlyCases } from "./references.ts";
import { shardOf } from "./shards.ts";
import { ssrSkip } from "./ssr-skip.ts";
import { checkMappedStack } from "./thrown.ts";
import "./context.ts";

const components = import.meta.glob<{ default: unknown }>("../cases/**/*.uf.tsx");

/** Whether a case's server render throws on purpose (`ssrThrows`, ADR-0078). */
const throwsOnPurpose = (info: CaseInfo) => info.config.ssrThrows !== undefined;

/** Registers shard `index` of this ssr project's renders: its share of the cases. */
export function describeSsrShard(index: number): void {
  const target = inject("target");
  const harness = inject("ufHarness");
  const server = inject("ufServer")!;
  const all = onlyCases(listCases(harness.casesDir), inject("ufOnly"));
  const cases = shardOf(all, index, inject("ufSsrShards"));

  describeServerRender(
    cases.flatMap((info): SsrCase[] => {
      const errors = errorState(info, target);
      // A case with compile errors has no output: the compile project records L6 as skipped.
      if (errors === true) return [];
      // A case whose every test requires a capability the target lacks renders differently
      // there by declaration (`ssr-skip.ts`).
      const skip = info.spec
        ? ssrSkip(
            specTests(readFileSync(info.spec, "utf8")),
            builtinTargets[target as TargetName].capabilities,
          )
        : undefined;
      return [
        {
          id: info.id,
          dir: info.dir,
          source: info.source,
          ...(skip === undefined ? {} : { skip }),
          ...(errors instanceof Error ? { failure: errors.message } : {}),
        },
      ];
    }),
  );

  /** The target's renderer, imported through this project's Vite pipeline (one framework copy). */
  async function renderer(): Promise<(component: unknown, options: { props: object }) => unknown> {
    const module = (await import(/* @vite-ignore */ server)) as {
      renderToString: (component: unknown, options: { props: object }) => unknown;
    };
    return module.renderToString;
  }

  // L14 (ADR-0078): a render that throws on purpose, apart from the scenarios L6 compares. Vitest
  // fails a describe without a test, so a shard without such a case leaves it out, unless no
  // case of the project has one: then each shard fails, as one file of them all did.
  if (!cases.some(throwsOnPurpose) && all.some(throwsOnPurpose)) return;
  describe(`ssr [${target}] throws`, () => {
    for (const info of cases) {
      if (!info.config.ssrThrows) continue;
      const errors = errorState(info, target);
      if (errors === true) continue;
      const key = `../cases/${info.id}/${basename(info.source)}`;
      const props = info.config.ssrThrows.props ?? {};
      it(`${info.id} › throws`, async ({ task }) => {
        if (errors instanceof Error) throw errors;
        await checkLayers(
          task,
          { case: info.id, target, quarantine: harness.quarantine },
          {
            async L14() {
              const load = components[key];
              if (!load) throw new Error(`import.meta.glob did not find ${key}.`);
              const component = (await load()).default;
              // The first Error, whichever way it comes: Angular's renderer logs it and resolves.
              let thrown: Error | undefined;
              const take = (value: unknown) => {
                if (value instanceof Error) thrown ??= value;
              };
              const original = console.error;
              console.error = (...args: unknown[]) => {
                args.forEach(take);
                original.apply(console, args);
              };
              try {
                await (async () => (await renderer())(component, { props }))().catch(take);
              } finally {
                console.error = original;
              }
              if (!thrown) throw new Error("The server render threw no Error.");
              checkMappedStack(info.dir, info.id, thrown.stack ?? "");
            },
          },
        );
      });
    }
  });
}
