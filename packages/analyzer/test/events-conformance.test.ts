// The event vocabulary `@unframework/ir` holds as data (ADR-0047), against what it stands for:
// the listeners the authoring types declare (the vendored Vue JSX `Events`), the interface lib.dom
// dispatches each event with, and the members of each interface both the DOM's event and React's
// synthetic event carry (@types/react, which the React target's output is checked against). The
// IR package cannot reach those files, so the analyser, which reads `onX` by this vocabulary,
// pins it. The check runs the `tsc` executable over a generated probe, as `types-conformance`
// does: it never loads TypeScript's API.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  DOM_EVENTS,
  EVENT_INTERFACES,
  PORTABLE_EVENT_MEMBERS,
  UNSUPPORTED_EVENTS,
  WINDOW_EVENTS,
} from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import { afterAll, describe, expect, it } from "vitest";

import { listenerName } from "../src/listeners.ts";

const ROOT = new URL("../../../", import.meta.url);

/** The listeners the vendored authoring types declare, as the events they name. */
function vueEvents(): Set<string> {
  const file = "packages/unframework/src/vendor/vue-jsx.d.ts";
  const program = parseModule(file, readFileSync(new URL(file, ROOT), "utf8")).program;
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : undefined;
    if (declaration?.type !== "TSInterfaceDeclaration" || declaration.id.name !== "Events") {
      continue;
    }
    return new Set(
      declaration.body.body.flatMap((member) =>
        member.type === "TSPropertySignature" && member.key.type === "Identifier"
          ? [member.key.name.slice(2).toLowerCase()]
          : [],
      ),
    );
  }
  throw new Error("The vendored JSX types declare no `Events`.");
}

/** React's synthetic event of a DOM interface, where it has one. */
const SYNTHETIC: ReadonlyMap<string, string> = new Map([
  ["Event", "SyntheticEvent"],
  ["UIEvent", "UIEvent"],
  ["MouseEvent", "MouseEvent"],
  ["PointerEvent", "PointerEvent"],
  ["DragEvent", "DragEvent"],
  ["WheelEvent", "WheelEvent"],
  ["KeyboardEvent", "KeyboardEvent"],
  ["FocusEvent", "FocusEvent"],
  ["InputEvent", "InputEvent"],
  ["CompositionEvent", "CompositionEvent"],
  ["TouchEvent", "TouchEvent"],
  ["AnimationEvent", "AnimationEvent"],
  ["TransitionEvent", "TransitionEvent"],
  ["ClipboardEvent", "ClipboardEvent"],
  ["SubmitEvent", "SubmitEvent"],
  ["ToggleEvent", "ToggleEvent"],
]);

const folder = mkdtempSync(join(tmpdir(), "uf-events-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

const HEADER = [
  'import type * as React from "react";',
  "type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;",
  "type Has<T, K> = K extends keyof T ? true : false;",
  "type Dispatched = GlobalEventHandlersEventMap & ElementEventMap & HTMLMediaElementEventMap;",
  "export {};",
];

/** Runs `tsc` over probe lines, each of which must type-check: the messages of those that fail. */
function failures(lines: readonly string[]): Map<number, string> {
  const require = createRequire(new URL("packages/target-react/package.json", ROOT));
  const react = dirname(require.resolve("@types/react/package.json"));
  writeFileSync(
    join(folder, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
        lib: ["esnext", "dom", "dom.iterable"],
        module: "esnext",
        moduleResolution: "bundler",
        target: "esnext",
        paths: { react: [join(react, "index.d.ts")] },
      },
      files: ["probe.ts"],
    }),
  );
  writeFileSync(join(folder, "probe.ts"), [...HEADER, ...lines].join("\n"));
  const local = createRequire(import.meta.url);
  const manifestPath = local.resolve("typescript/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tsc: string } };
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(manifestPath), manifest.bin.tsc),
      "-p",
      join(folder, "tsconfig.json"),
      "--pretty",
      "false",
    ],
    { cwd: folder, encoding: "utf8" },
  );
  if (result.error) throw new Error(`could not start tsc: ${result.error.message}`);
  const found = new Map<number, string>();
  for (const line of `${result.stdout}${result.stderr}`.split("\n")) {
    const match = /probe\.ts\((\d+),\d+\): (.*)$/.exec(line);
    if (match) found.set(Number(match[1]) - HEADER.length - 1, match[2]!);
    else if (line.trim()) throw new Error(`tsc reported more than the probe: ${line}`);
  }
  return found;
}

describe("the event vocabulary", () => {
  it("is the authoring types' listeners, without `dragexit`, with the dialog's events", () => {
    const vue = vueEvents();
    const declared = new Set([...vue].filter((event) => event !== "dragexit"));
    for (const event of ["cancel", "close", "command"]) declared.add(event);
    expect([...DOM_EVENTS.keys()].toSorted()).toEqual([...declared].toSorted());
    expect(UNSUPPORTED_EVENTS.has("dragexit")).toBe(true);
  });

  it("reads every listener the vocabulary names, in Vue's spelling", () => {
    for (const event of [
      ...DOM_EVENTS.keys(),
      ...WINDOW_EVENTS.keys(),
      ...UNSUPPORTED_EVENTS.keys(),
    ]) {
      const name = `on${event[0]!.toUpperCase()}${event.slice(1)}`;
      expect(listenerName(name), name).toEqual({ event, options: [], canonical: name });
      expect(listenerName(`on${event}`)?.canonical, `on${event}`).toBe(name);
    }
  });

  it(
    "names the interfaces lib.dom dispatches with, and members both the DOM's and React's events carry",
    { timeout: 60_000 },
    () => {
      const checks: { what: string; line: string }[] = [];
      for (const [event, name] of DOM_EVENTS) {
        checks.push({
          what: `${event} is a ${name}`,
          line: `const e${checks.length}: Equal<Dispatched[${JSON.stringify(event)}], ${name}> = true;`,
        });
      }
      for (const [event, name] of WINDOW_EVENTS) {
        checks.push({
          what: `${event} is a ${name}`,
          line: `const e${checks.length}: Equal<WindowEventHandlersEventMap[${JSON.stringify(event)}], ${name}> = true;`,
        });
      }
      for (const [name, parent] of EVENT_INTERFACES) {
        if (!parent) continue;
        checks.push({
          what: `${name} extends ${parent}`,
          line: `const e${checks.length}: ${name} extends ${parent} ? true : false = true;`,
        });
      }
      for (const [name, members] of PORTABLE_EVENT_MEMBERS) {
        const synthetic = SYNTHETIC.get(name);
        for (const member of members) {
          checks.push({
            what: `${name} has ${member}`,
            line: `const e${checks.length}: Has<${name}, ${JSON.stringify(member)}> = true;`,
          });
          if (!synthetic) continue;
          checks.push({
            what: `React's ${synthetic} has ${member}`,
            line: `const e${checks.length}: Has<React.${synthetic}, ${JSON.stringify(member)}> = true;`,
          });
        }
      }
      const failed = failures(checks.map((check) => check.line));
      expect([...failed].map(([line, message]) => `${checks[line]!.what}: ${message}`)).toEqual([]);
      expect(checks.length).toBeGreaterThan(500);
    },
  );
});
