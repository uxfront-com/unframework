// The Node half of the render-parity kit (./render-parity.ts): emitting the cases through a
// target, reading which of them its capability matrix declares unsupported, the attribute
// sweep, and the Vite plugin that serves the emitted components to a target package's browser
// project, where the framework's own client renderer mounts them.
import { sep } from "node:path";
import { fileURLToPath } from "node:url";

import { analyze } from "@unframework/analyzer";
import {
  ARIA_ATTRIBUTES,
  createComponent,
  createExport,
  createModule,
  ELEMENT_ATTRIBUTES,
  FIXED_VALUE_INPUT_TYPES,
  GLOBAL_ATTRIBUTES,
  HTML_ELEMENTS,
  isBooleanAttribute,
  isVoidElement,
  NUMERIC_ATTRIBUTES,
  REQUIRED_PARENTS,
  TRUE_VALUED_ATTRIBUTES,
  URL_ATTRIBUTES,
} from "@unframework/ir";
import type { UfModule } from "@unframework/ir";
import { parseModule } from "@unframework/parser";
import type { Plugin } from "vite";
import type { TestProjectInlineConfiguration, ViteUserConfig } from "vitest/config";
import type { BrowserProviderOption } from "vitest/node";

import { formatOutput, requiredCapabilities } from "../src/index.ts";
import type { CapabilityName, EmitContext, OutputFile, Target } from "../src/index.ts";
import type { ClientCase } from "./render-parity-client.ts";
import { CARRIAGE_RETURN_CASES, el, PARITY_SUITES } from "./render-parity.ts";
import type { ParityCase, ParitySuite } from "./render-parity.ts";

/** The name the parity component is emitted under. */
const PARITY_COMPONENT = "RenderParity";

/** A module with one component that renders every case side by side in a `<div>`. */
export function parityModule(cases: readonly ParityCase[]): UfModule {
  const at = { start: 0, end: 0 };
  const render = el("div", {}, ...cases.map(({ render: tree }) => tree));
  return createModule(
    `${PARITY_COMPONENT}.uf.tsx`,
    [createComponent(PARITY_COMPONENT, render, at)],
    [createExport("default", PARITY_COMPONENT, at)],
  );
}

/**
 * The capabilities a case uses that the target's matrix marks unsupported, by the derivation
 * the compiler's capability check reads: the compiler reports such a case for the target, so
 * its client test leaves the case out and checks that it still renders differently.
 */
export function unsupportedCapabilities(target: Target, parityCase: ParityCase): CapabilityName[] {
  return [...requiredCapabilities(parityModule([parityCase])).keys()].filter(
    (capability) => target.capabilities[capability].support === "unsupported",
  );
}

/**
 * What a target emits for the cases, formatted as the compiler formats it or left in the
 * printer's layout (the dev server's path). Fails on anything the target reports: what it
 * cannot render exactly, it declares in its capability matrix (`unsupportedCapabilities`). Fails
 * on any formatting error too.
 */
export async function emitParity(
  target: Target,
  cases: readonly ParityCase[],
  { format }: { format: boolean },
): Promise<OutputFile[]> {
  const module = parityModule(cases);
  const reported: Parameters<EmitContext["report"]>[0][] = [];
  const context: EmitContext = {
    module,
    options: undefined,
    report: (diagnostic) => void reported.push(diagnostic),
  };
  const files = module.components.flatMap((component) => target.emit(component, context));
  if (reported.length) {
    const reports = reported.map(({ code, message }) => `${code} (${message})`).join(", ");
    throw new Error(`${target.name} reported ${reports} for the cases.`);
  }
  if (!format) return files;
  return Promise.all(
    files.map(async (file) => {
      const outcome = await formatOutput(file);
      if (outcome.error) throw new Error(`${file.path} does not format: ${outcome.error}`);
      return outcome.file;
    }),
  );
}

/** One attribute the sweep tries, with the attributes it only exists beside. */
interface SweepCandidate {
  /** What the case is called, and which candidates are alternatives for the same attribute. */
  key: string;
  tag: string;
  attributes: Record<string, string | true>;
}

/** The parent the sweep puts an element in when HTML requires one, where there is a choice. */
const SWEEP_PARENT: Readonly<Record<string, string>> = { tr: "tbody", dd: "dl", dt: "dl" };

/**
 * The content the sweep gives an element whose attributes act on its children, so that they
 * do: a select's `size` and `multiple` and an option group's `disabled` decide which option
 * starts selected, a list's `start`, `reversed` and `type` number its items, and `open` shows
 * what follows a summary.
 */
const SWEEP_CONTENT: Readonly<Record<string, string>> = {
  select: "<option>a</option>",
  optgroup: "<option>a</option>",
  ol: "<li>a</li>",
  ul: "<li>a</li>",
  details: "<summary>a</summary>b",
};

/**
 * The parent the sweep puts an element in where HTML would allow it anywhere, but its
 * attributes act only there: an option's and an option group's `disabled` decide which option
 * a select starts with.
 */
const SWEEP_CONTEXT: Readonly<Record<string, string>> = { option: "select", optgroup: "select" };

/** Inputs whose `value` is a label or a submitted value, which the analyzer accepts. */
const FIXED_VALUE_TYPES = [...FIXED_VALUE_INPUT_TYPES];

/** The attributes that override a form's submission, which only submit buttons take. */
const SUBMISSION_OVERRIDES = [
  "formaction",
  "formenctype",
  "formmethod",
  "formnovalidate",
  "formtarget",
];

/**
 * The values the sweep tries for an attribute, most specific first: the analyzer takes the
 * first one it accepts. URLs are `data:` URLs, so nothing a browser renders makes a request.
 */
function sweepValues(tag: string, name: string): (string | true)[] {
  if (isBooleanAttribute(name)) return [true];
  if (NUMERIC_ATTRIBUTES.get(tag)?.has(name)) return ["2"];
  if (TRUE_VALUED_ATTRIBUTES.has(name)) return ["true", "false"];
  if (URL_ATTRIBUTES.has(name) || name.endsWith("srcset")) return ["data:,", "/x"];
  return ["x", "1", "true"];
}

/** Every attribute the sweep tries: global ones on a `<div>`, every element's own on it. */
function sweepCandidates(): SweepCandidate[] {
  const candidates: SweepCandidate[] = [];
  const add = (key: string, tag: string, name: string, extra: Record<string, string> = {}) => {
    for (const value of sweepValues(tag, name)) {
      candidates.push({ key, tag, attributes: { ...extra, [name]: value } });
    }
  };
  for (const name of [...GLOBAL_ATTRIBUTES, ...ARIA_ATTRIBUTES, "data-x"]) {
    add(`<div ${name}>`, "div", name);
  }
  for (const tag of HTML_ELEMENTS) {
    // Every element once, so each renderer creates each one.
    add(`<${tag}>`, tag, "title");
    for (const name of ELEMENT_ATTRIBUTES.get(tag) ?? []) add(`<${tag} ${name}>`, tag, name);
  }
  for (const type of FIXED_VALUE_TYPES) {
    add(`<input type="${type}" value>`, "input", "value", { type });
  }
  for (const name of SUBMISSION_OVERRIDES) {
    add(`<input type="submit" ${name}>`, "input", name, { type: "submit" });
  }
  return candidates;
}

/**
 * JSX for an element with its attributes and the content they act on, inside the parent they
 * act in and the parents HTML requires it to have.
 */
function sweepSource({ tag, attributes }: SweepCandidate): string {
  const written = Object.entries(attributes)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${value}"`))
    .join("");
  let source = isVoidElement(tag)
    ? `<${tag}${written} />`
    : `<${tag}${written}>${SWEEP_CONTENT[tag] ?? ""}</${tag}>`;
  const context = SWEEP_CONTEXT[tag];
  if (context) source = `<${context}>${source}</${context}>`;
  for (
    let child = tag, parents = REQUIRED_PARENTS.get(child);
    parents;
    parents = REQUIRED_PARENTS.get(child)
  ) {
    child = SWEEP_PARENT[child] ?? [...parents][0]!;
    source = `<${child}>${source}</${child}>`;
  }
  return source;
}

let sweep: readonly ParityCase[] | undefined;

/**
 * The attribute sweep: every (element, attribute) pair the analyzer accepts, each on its own
 * element, with the first value it accepts, as the IR it lowers it to. Global and ARIA
 * attributes are tried on a `<div>`, each element's own attributes on that element, and `value`
 * on every input type that takes one. The analyzer decides, so the sweep follows what it
 * accepts: an attribute it starts accepting is rendered by every target from then on.
 */
export function attributeSweep(): readonly ParityCase[] {
  if (sweep) return sweep;
  const candidates = sweepCandidates();
  const source = candidates
    .map(
      (candidate, index) =>
        `export function Sweep${index}() {\n  return <div>${sweepSource(candidate)}</div>;\n}\n`,
    )
    .join("");
  // A component the analyzer rejects is left out of the module; its siblings are not.
  const { module } = analyze(parseModule("Sweep.uf.tsx", source));
  if (!module) throw new Error("The analyzer rejected the whole attribute sweep.");
  const seen = new Set<string>();
  const cases: ParityCase[] = [];
  for (const component of module.components) {
    const candidate = candidates[Number(component.name.slice("Sweep".length))]!;
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    cases.push({ name: candidate.key, render: component.render });
  }
  // A few hundred pairs; far fewer means the analyzer or the candidates broke.
  if (cases.length < 200) {
    throw new Error(`The analyzer accepts only ${cases.length} pairs of the attribute sweep.`);
  }
  sweep = cases;
  return sweep;
}

/** Every suite each target's render-parity tests run: the kit's cases and the attribute sweep. */
export function paritySuites(): readonly ParitySuite[] {
  return [...PARITY_SUITES, ["the attribute sweep", attributeSweep()]];
}

/** Options for {@link renderParityModules}. */
export interface ParityModulesOptions {
  target: Target;
  /** The extension of the target's output file, which the framework's Vite plugin claims. */
  extension: string;
  /**
   * Whether to serve the formatted output besides the printer's layout. Markup is never
   * formatted (ADR-0026), so for Vue and Svelte the two are the same file.
   */
  formatted: boolean;
  /**
   * Whether to serve each case as a component of its own too. Vue renders a small static
   * template through `patchProp`, which sets some attributes as DOM properties, and a large
   * one through `innerHTML`: only small components take the first path.
   */
  perCase?: boolean;
  /** The suites to serve; by default {@link clientParitySuites}. */
  suites?: readonly ParitySuite[];
}

/**
 * The suites a client renderer must render as the IR describes: all but the carriage returns.
 * The IR holds none (ADR-0030: the analyzer reports one as UF3010), and the printers' escapes
 * for them are checked on the server; Solid's and Svelte's client compiles fold static text and
 * attributes into HTML template strings, whose parsing turns them into line feeds.
 */
export function clientParitySuites(): readonly ParitySuite[] {
  return paritySuites().filter(([, cases]) => cases !== CARRIAGE_RETURN_CASES);
}

/**
 * The module a browser test imports the suites from, which the plugin replaces with the
 * suites and a loader for each component (a real file, so that its types are real).
 */
const MANIFEST = fileURLToPath(new URL("render-parity-manifest.ts", import.meta.url))
  .split(sep)
  .join("/");
/** Where the emitted components live, under the Vite root (no file is ever written there). */
const PARITY_DIRECTORY = "/__uf_render_parity__/";

/** One component the plugin serves. */
interface ServedComponent {
  suite: number;
  format: boolean;
  /** The index of the case it renders alone, or `undefined` when it renders the whole suite. */
  only?: number;
}

/**
 * Serves the parity components to a browser project: ./render-parity-manifest.ts lists the
 * suites, and each component is a module under `/__uf_render_parity__/` with the target's
 * extension, so the framework's own Vite plugin compiles it as it would the unplugin's output.
 */
export function renderParityModules(options: ParityModulesOptions): Plugin {
  const suites = options.suites ?? clientParitySuites();
  const served = new Map<string, ServedComponent>();
  suites.forEach(([, cases], suite) => {
    for (const format of options.formatted ? [true, false] : [false]) {
      const base = `${PARITY_DIRECTORY}${suite}-${format ? "formatted" : "printed"}`;
      served.set(`${base}${options.extension}`, { suite, format });
      if (!options.perCase) continue;
      cases.forEach((_, only) =>
        served.set(`${base}-${only}${options.extension}`, { suite, format, only }),
      );
    }
  });
  let root = "";
  /** The served path of an id or URL with its query, or `undefined` when it is not one. */
  const servedPath = (id: string) => {
    const [path = ""] = id.split("?");
    const relative = root && path.startsWith(`${root}/`) ? path.slice(root.length) : path;
    return served.has(relative) ? relative : undefined;
  };

  return {
    name: "uf-render-parity",
    enforce: "pre",
    configResolved(config) {
      root = config.root;
    },
    resolveId(source) {
      const path = servedPath(source);
      if (path === undefined) return null;
      // Queries are the framework plugin's requests for parts of the module (`?vue&type=…`).
      const query = source.includes("?") ? source.slice(source.indexOf("?")) : "";
      return `${root}${path}${query}`;
    },
    async load(id) {
      if (id === MANIFEST) return manifest(options.target, suites, served);
      if (id.includes("?")) return null;
      const path = servedPath(id);
      if (path === undefined) return null;
      const { suite, format, only } = served.get(path)!;
      const cases = suites[suite]![1];
      const [file, ...rest] = await emitParity(
        options.target,
        only === undefined ? cases : [cases[only]!],
        { format },
      );
      if (rest.length || !file?.path.endsWith(options.extension)) {
        throw new Error(`${options.target.name} did not emit one ${options.extension} file.`);
      }
      return file.contents;
    },
  };
}

/**
 * The manifest's code: each suite's cases as JSON, with the capabilities each uses that the
 * target's matrix marks unsupported, and a dynamic import per component.
 */
function manifest(
  target: Target,
  suites: readonly ParitySuite[],
  served: ReadonlyMap<string, ServedComponent>,
): string {
  const components = suites.map(() => [] as string[]);
  for (const [path, { suite, format, only }] of served) {
    components[suite]!.push(
      `{ format: ${format}, only: ${only ?? "undefined"}, load: () => import(${JSON.stringify(path)}) }`,
    );
  }
  const entries = suites.map(([title, cases], suite) => {
    const listed = cases.map((parityCase): ClientCase => ({
      ...parityCase,
      unsupported: unsupportedCapabilities(target, parityCase),
    }));
    return `{ title: ${JSON.stringify(title)}, cases: ${JSON.stringify(listed)}, components: [${components[suite]!.join(", ")}] }`;
  });
  return `export const suites = [\n${entries.join(",\n")}\n];\n`;
}

/** Options for {@link browserProject}. */
export interface BrowserProjectOptions {
  /** Vitest's Playwright provider, from the package's own `@vitest/browser-playwright`. */
  provider: BrowserProviderOption;
  /** The target toolchain's browser configuration (`toolchain.vite("browser", …)`). */
  vite?: ViteUserConfig;
  /** The parity components to serve, for a target package. */
  modules?: ParityModulesOptions;
}

/**
 * A package's `browser` project: its `test/**\/*.browser.test.ts` in headless Chromium, with
 * the target's own Vite plugins and the parity components they compile.
 */
export function browserProject(options: BrowserProjectOptions): TestProjectInlineConfiguration {
  const { provider, vite = {}, modules } = options;
  return {
    ...vite,
    plugins: [...(modules ? [renderParityModules(modules)] : []), ...(vite.plugins ?? [])],
    test: {
      ...vite.test,
      name: "browser",
      include: ["test/**/*.browser.test.ts"],
      browser: {
        enabled: true,
        provider,
        headless: true,
        // Named, or Vitest calls the project "browser (chromium)".
        instances: [{ browser: "chromium", name: "browser" }],
        screenshotFailures: false,
      },
    },
  };
}
