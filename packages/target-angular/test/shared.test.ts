// Angular's shared helper modules (ADR-0121): with `helper`, each helper that passes R1 to R4 is a
// module of its own, whose text depends only on the helper, and every component of a source
// imports it alike.
import { createHelperModules, formatOutput } from "@unframework.dev/codegen";
import type { EmitContext, OutputFile } from "@unframework.dev/codegen";
import { describe, expect, it } from "vitest";

import target from "../src/index.ts";
import { directiveModule, SHARED_HELPER_NAMES, sharedModule } from "../src/shared.ts";
import { lower } from "./helpers.ts";

/** Every component's and directive's files of a source, and its helper modules. */
function emitShared(source: string, file = "Fixture.uf.tsx") {
  const module = lower(source, file);
  const modules = createHelperModules();
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => {
      throw new Error(`The Angular target reported ${diagnostic.code}: ${diagnostic.message}`);
    },
    helper: modules.helper,
  };
  const files: OutputFile[] = [
    ...module.components.flatMap((component) => target.emit(component, context)),
    ...(module.directives ?? []).flatMap((directive) => target.emitDirective!(directive, context)),
  ];
  return { files, helpers: modules.files() };
}

/** The file of a component's output, by its path. */
const fileAt = (files: readonly OutputFile[], path: string) =>
  files.find((file) => file.path === path)!.contents;

/** The text of the `ClickCapture` module among a compile's helper modules. */
const clickCapture = (helpers: readonly OutputFile[]) =>
  helpers.find(({ path }) => path === "_unframework/ClickCapture.ts")!.contents;

const importsOf = (contents: string) => contents.match(/^import .*_unframework.*$/gm) ?? [];

/** Whether the code declares `name` at its top level, as a function, a class or a constant. */
const declares = (contents: string, name: string) =>
  new RegExp(`^(?:export )?(?:function|class|const) ${name}\\b`, "m").test(contents);

const EVENTS = `export default function Panel() {
  function record(what: string) {
    console.log(what);
  }
  return (
    <section aria-label="Panel" onWheelPassive={() => record("wheel")}>
      <button type="button" onClickCapture={() => record("capture")}>Capture</button>
      <button type="button" onClickOnce={() => record("once")}>Once</button>
    </section>
  );
}
`;

const MODELS = `import { ref } from "@uxfront/unframework";

export default function Weight() {
  const weight = ref(0);
  const note = ref("");
  return (
    <form>
      <input type="text" aria-label="Weight" v-model_number={weight.value} />
      <textarea aria-label="Note" v-model={note.value} />
    </form>
  );
}
`;

describe("shared helper modules", () => {
  it.each(SHARED_HELPER_NAMES)(
    "prints %s's module as valid, formatted TypeScript",
    async (name) => {
      const text = sharedModule(name);
      expect(text).toMatch(new RegExp(`^export (function|class|type) ${name}\\b`, "m"));
      const outcome = await formatOutput({ path: `${name}.ts`, contents: text });
      expect(outcome.error).toBeUndefined();
      // Only the framework and the helper's siblings (A1, A2).
      for (const [, specifier] of text.matchAll(/from "([^"]+)"/g)) {
        expect(specifier).toMatch(
          /^(?:@angular\/core|@angular\/common|@angular\/platform-browser|\.\/\w+)$/,
        );
      }
    },
  );

  it("keeps the scope map private to ScopeAttributes' module", () => {
    const text = sharedModule("ScopeAttributes");
    expect(text).toMatch(/^const scopes = new WeakMap<Element, string\[\]>\(\);$/m);
    expect(text).toMatch(/^export class ScopeAttributes implements OnInit \{$/m);
    expect(text).not.toMatch(/^export const scopes\b/m);
  });

  it("imports looseToNumber as a sibling in modelText and writeModelText (A1)", () => {
    for (const name of ["modelText", "writeModelText"]) {
      expect(sharedModule(name)).toMatch(/^import \{ looseToNumber \} from "\.\/looseToNumber";$/m);
      expect(declares(sharedModule(name), "looseToNumber")).toBe(false);
    }
  });

  it("puts each event directive in a module of its own, named by its event and option", () => {
    const { files, helpers } = emitShared(EVENTS);
    const panel = fileAt(files, "panel.ts");
    for (const name of ["ClickCapture", "ClickOnce", "WheelPassive"]) {
      expect(panel).toContain(`import { ${name} } from "./_unframework/${name}";`);
      expect(declares(panel, name)).toBe(false);
    }
    expect(panel).toMatch(
      /imports: \[\s*WheelPassive,\s*ClickCapture,\s*ClickOnce,\s*ScopeAttributes,/,
    );
    const capture = helpers.find(({ path }) => path === "_unframework/ClickCapture.ts")!;
    expect(capture.contents).toContain('@Directive({ selector: "[ufClickCapture]" })');
    expect(capture.contents).toContain("export class ClickCapture {");
    expect(capture.contents).toContain("{ capture: true }");
  });

  it("gives an event directive's module the same text in every source", () => {
    const one = emitShared(EVENTS).helpers;
    const other = emitShared(
      'export default function Other() {\n  return <button type="button" onClickCapture={() => console.log("x")}>x</button>;\n}\n',
      "Other.uf.tsx",
    ).helpers;
    expect(clickCapture(one)).toBe(clickCapture(other));
  });

  it("imports ScopeAttributes alike in every component of a source", () => {
    const source = `export default function Card() {
  return (
    <section class="card">
      <Badge />
    </section>
  );
}

export function Badge() {
  return <i class="badge">Badge</i>;
}
`;
    const { files, helpers } = emitShared(source);
    const [card, badge] = files;
    expect(importsOf(card!.contents)).toEqual(
      expect.arrayContaining(['import { ScopeAttributes } from "./_unframework/ScopeAttributes";']),
    );
    expect(importsOf(card!.contents)).toEqual(importsOf(badge!.contents));
    expect(declares(card!.contents, "ScopeAttributes")).toBe(false);
    expect(declares(card!.contents, "scopes")).toBe(false);
    // Each root element takes what its consumer passes, through the shared `Fallthrough` too.
    expect(helpers.map(({ path }) => path)).toEqual([
      "_unframework/Fallthrough.ts",
      "_unframework/Listeners.ts",
      "_unframework/ScopeAttributes.ts",
    ]);
    expect(fileAt(helpers, "_unframework/ScopeAttributes.ts")).toBe(
      sharedModule("ScopeAttributes"),
    );
  });

  it("shares Fallthrough and the listeners' types, which each component imports alike", () => {
    // A root element takes the records through the directive, an SVG root's typed by the SVG
    // event map, and a root component passes them on, so it imports only their type.
    const source = `export default function Card() {
  return <section class="card">Card</section>;
}

export function Icon() {
  return <svg viewBox="0 0 1 1" />;
}

export function Framed() {
  return <Card />;
}
`;
    const { files, helpers } = emitShared(source);
    const directive = 'import { Fallthrough } from "./_unframework/Fallthrough";';
    const listeners = 'import type { Listeners } from "./_unframework/Listeners";';
    const svgListeners = 'import type { SvgListeners } from "./_unframework/Listeners";';
    const card = fileAt(files, "card.ts");
    const icon = fileAt(files, "icon.ts");
    const framed = fileAt(files, "framed.ts");
    // Beside `ScopeAttributes`, which each root takes too.
    const fallthroughImports = (contents: string) =>
      importsOf(contents).filter((line) => !line.includes("ScopeAttributes"));
    expect(fallthroughImports(card)).toEqual([directive, listeners]);
    expect(fallthroughImports(icon)).toEqual([directive, svgListeners]);
    expect(fallthroughImports(framed)).toEqual([listeners]);
    expect(card).toContain("readonly ufListeners = input<Listeners>();");
    expect(icon).toContain("readonly ufListeners = input<SvgListeners>();");
    expect(card).toMatch(/imports: \[[^\]]*\bFallthrough\b/);
    expect(framed).not.toMatch(/\bFallthrough\b/);
    for (const contents of [card, icon, framed]) {
      expect(declares(contents, "Fallthrough")).toBe(false);
      expect(contents).not.toMatch(/^(?:export )?type (?:Svg)?Listeners\b/m);
    }
    expect(fileAt(helpers, "_unframework/Fallthrough.ts")).toBe(sharedModule("Fallthrough"));
    expect(fileAt(helpers, "_unframework/Listeners.ts")).toBe(sharedModule("Listeners"));
    // The directive takes either type's record, from its sibling.
    expect(sharedModule("Fallthrough")).toMatch(
      /^import type \{ Listeners, SvgListeners \} from "\.\/Listeners";$/m,
    );
    expect(sharedModule("Fallthrough")).toContain(
      "listeners: Listeners | SvgListeners | undefined;",
    );
    expect(sharedModule("Listeners")).toMatch(/^export type SvgListeners = .*SVGElementEventMap/m);
  });

  it("imports a helper under one free name where a component of the source declares it", () => {
    const source = `const ScopeAttributes = "taken";

export default function Card() {
  return (
    <section class="card" title={ScopeAttributes}>
      <Badge />
    </section>
  );
}

export function Badge() {
  return <i class="badge">Badge</i>;
}
`;
    const { files } = emitShared(source);
    const [card, badge] = files;
    const line =
      'import { ScopeAttributes as ScopeAttributes_1 } from "./_unframework/ScopeAttributes";';
    expect(importsOf(card!.contents)).toContain(line);
    expect(importsOf(badge!.contents)).toContain(line);
    expect(card!.contents).toMatch(/imports: \[[^\]]*\bScopeAttributes_1,/);
    expect(badge!.contents).toMatch(/imports: \[[^\]]*\bScopeAttributes_1,/);
  });

  it("shares the model helpers, and imports looseToNumber only through them", () => {
    const { files, helpers } = emitShared(MODELS);
    const weight = fileAt(files, "weight.ts");
    for (const name of ["modelText", "writeModelText", "TextCaret"]) {
      expect(weight).toContain(`import { ${name} } from "./_unframework/${name}";`);
      expect(declares(weight, name)).toBe(false);
    }
    expect(weight).not.toContain("looseToNumber");
    // The template reads them through members of their names, as it reads the inline ones.
    expect(weight).toContain("protected readonly modelText = modelText;");
    expect(helpers.map(({ path }) => path)).toEqual([
      "_unframework/Fallthrough.ts",
      "_unframework/Listeners.ts",
      "_unframework/ScopeAttributes.ts",
      "_unframework/TextCaret.ts",
      "_unframework/looseToNumber.ts",
      "_unframework/modelText.ts",
      "_unframework/writeModelText.ts",
    ]);
  });

  it("shares the queue of a directive module, and keeps its runner inline (R2)", () => {
    const source = `import { defineDirective } from "@uxfront/unframework";

const queueHook = "taken";

export const vMark = defineDirective<string>({
  mounted(el, value) {
    el.setAttribute("data-mark", value + queueHook);
  },
});
`;
    const { files, helpers } = emitShared(source, "mark.uf.ts");
    const mark = fileAt(files, "v-mark.ts");
    expect(mark).toContain('import { queueHook as queueHook_1 } from "./_unframework/queueHook";');
    expect(mark).toContain("queueHook_1(");
    expect(mark).not.toMatch(/^function queueHook/m);
    expect(mark).toMatch(/^function runDirective\b/m);
    expect(helpers.map(({ path }) => path)).toEqual(["_unframework/queueHook.ts"]);
  });

  it("keeps Transition and TransitionRegion inline (R2)", () => {
    const source = `import { ref, Transition } from "@uxfront/unframework";

export default function Toggle() {
  const open = ref(false);
  return (
    <div>
      <button type="button" onClick={() => (open.value = !open.value)}>Toggle</button>
      <Transition name="fade">{open.value ? <p>Hello</p> : null}</Transition>
    </div>
  );
}
`;
    const { files, helpers } = emitShared(source);
    const toggle = fileAt(files, "toggle.ts");
    expect(declares(toggle, "Transition")).toBe(true);
    expect(declares(toggle, "TransitionRegion")).toBe(true);
    expect(helpers.map(({ path }) => path)).not.toContain("_unframework/Transition.ts");
    expect(helpers.map(({ path }) => path)).not.toContain("_unframework/TransitionRegion.ts");
  });

  it("shares TrustedHtmlPipe", () => {
    const source = `export default function Note(props: { html: string }) {
  return <div innerHTML={props.html} />;
}
`;
    const module = lower(source, "Note.uf.tsx", true);
    const modules = createHelperModules();
    const [note] = target.emit(module.components[0]!, {
      module,
      options: undefined,
      report: () => {},
      helper: modules.helper,
    });
    expect(note!.contents).toContain(
      'import { TrustedHtmlPipe } from "./_unframework/TrustedHtmlPipe";',
    );
    expect(declares(note!.contents, "TrustedHtmlPipe")).toBe(false);
    expect(modules.files().map(({ path }) => path)).toContain("_unframework/TrustedHtmlPipe.ts");
  });

  it("prints every helper inline without helper, as before", () => {
    const module = lower(MODELS, "Weight.uf.tsx");
    const [file] = target.emit(module.components[0]!, {
      module,
      options: undefined,
      report: () => {},
    });
    expect(file!.contents).not.toContain("_unframework");
    for (const name of [
      "ScopeAttributes",
      "scopes",
      "modelText",
      "writeModelText",
      "looseToNumber",
      "TextCaret",
    ]) {
      expect(declares(file!.contents, name)).toBe(true);
    }
  });

  it("prints a directive module whose class is its export name", () => {
    const text = directiveModule({
      event: "keydown",
      option: "once",
      output: "ufKeydownOnce",
      name: "KeydownOnce",
      className: "KeydownOnce_1",
      eventType: "KeyboardEvent",
    });
    expect(text).toContain("export class KeydownOnce {");
    expect(text).toContain(
      "readonly ufKeydownOnce = output<KeyboardEvent>();\n\n  constructor() {",
    );
    expect(text).not.toContain("KeydownOnce_1");
  });
});
