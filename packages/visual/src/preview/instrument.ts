// An example's controls (ADR-0113): the preview gives an example one optional prop per control,
// and binds it on each instance of the control's component that leaves that prop unset, so the
// example's own values hold. The rewrite exists only for the preview's servers, through the
// unframework plugin's `transformSource`: `unframework visual`, the tests and the corpus read the
// example as written.
import { readFile } from "node:fs/promises";
import { posix } from "node:path";

import { compile, createFileResolver, createSyntacticOracle } from "@unframework.dev/compiler";
import type { Resolver } from "@unframework.dev/compiler";
import { walk } from "@unframework.dev/ir";
import type { ComponentNode, UfModule } from "@unframework.dev/ir";

import type { PropControl, PropControls, UncontrolledProp } from "./controls.ts";

/** A live control of an example: a prop of one component, sent under its own key. */
export type ExampleControl = PropControl & {
  /** The prop the example takes for it, `ufControl<n>`: unique across the example. */
  key: string;
};

/** The controls of one component an example renders, in the order of its first instance. */
export interface ExampleControlGroup {
  /** The catalogue component's id. */
  component: string;
  /** Its name. */
  name: string;
  /** The props an instance leaves unset somewhere, in member order: each optional. */
  controls: Array<ExampleControl>;
  /** The controllable props every instance sets, in member order. */
  setByExample: Array<string>;
  /** The props no control can set, as a component entry lists them. */
  uncontrolled: Array<UncontrolledProp>;
}

/** A catalogue component, as the analysis matches an instance to it. */
export interface CatalogueComponent extends PropControls {
  id: string;
  name: string;
  /** Its file, absolute. */
  file: string;
}

/** One instance of a catalogue component in an example's render. */
interface Instance {
  component: CatalogueComponent;
  /** The props the child declares now, as the import's API reads them. */
  declared: Set<string>;
  /** The props the instance sets. */
  set: Set<string>;
  /** Where its binding goes: just after `<Name`. */
  insertAt: number;
}

/** An example the preview can instrument: its instances, and where its parameter goes. */
interface Analysis {
  instances: Array<Instance>;
  /** Just after the `(` of the default export's empty parameter list. */
  parameterAt: number;
}

/** The prefix of a control's key. */
const KEY_PREFIX = "ufControl";

/** The name the example's parameter takes, unless the source already uses it. */
const PARAMETER = "ufPreview";

const toPosix = (path: string) => path.replaceAll("\\", "/");

/**
 * Analyses an example: the instances of catalogue components its default export renders, and
 * where its parameter goes. Gives `undefined` for an example that does not compile, declares
 * props (UF7011) or whose text the analysis cannot place, which the preview serves as written,
 * so the real compile reports its real errors.
 */
async function analyse(
  source: string,
  file: string,
  root: string,
  resolver: Resolver,
  components: ReadonlyArray<CatalogueComponent>,
): Promise<Analysis | undefined> {
  const filename = posix.relative(toPosix(root), toPosix(file));
  let ir: UfModule | undefined;
  try {
    const result = await compile(source, { filename, targets: [], resolve: resolver });
    if (result.diagnostics.some((each) => each.severity === "error")) {
      return undefined;
    }
    ir = result.ir;
  } catch {
    return undefined;
  }
  if (!ir) {
    return undefined;
  }
  const local = ir.exports.find((each) => each.kind === "default")?.local;
  const example = ir.components.find((each) => each.name === local);
  if (!example || example.propsParameter) {
    return undefined;
  }
  const parameterAt = emptyParameters(source, example.name, example.span);
  if (parameterAt === undefined) {
    return undefined;
  }

  // A local name of an imported default export, by the catalogue component its file is.
  const byFile = new Map(components.map((each) => [toPosix(each.file), each]));
  const directory = posix.dirname(toPosix(file));
  const imported = new Map<string, { component: CatalogueComponent; declared: Set<string> }>();
  for (const each of ir.imports ?? []) {
    const component = byFile.get(posix.join(directory, each.file));
    if (!component) {
      continue;
    }
    const api = each.api.components.find((entry) => entry.export === "default");
    const declared = new Set(api?.props.map((prop) => prop.name));
    for (const name of each.names) {
      if (name.kind === "Component" && name.imported === "default") {
        imported.set(name.local, { component, declared });
      }
    }
  }

  // Only the default export's render: a component the file declares is not the example, and an
  // instance under `<component is>` is a `Dynamic` node, whose candidates all take its attributes.
  const instances: Array<Instance> = [];
  let placed = true;
  walk(example.render, {
    enter(node) {
      if (node.kind !== "Component") {
        return;
      }
      const match = imported.get(node.component);
      if (!match) {
        return;
      }
      const insertAt = afterTagName(source, node);
      if (insertAt === undefined) {
        placed = false;
        return;
      }
      const set = new Set(
        node.attributes.flatMap((attribute) => (attribute.kind === "Prop" ? [attribute.name] : [])),
      );
      instances.push({ ...match, set, insertAt });
    },
  });
  if (!placed) {
    return undefined;
  }
  instances.sort((a, b) => a.insertAt - b.insertAt);
  return { instances, parameterAt };
}

/**
 * Just after the `(` of `function <name>()`, from the component's span, or `undefined` when the
 * text there is not that empty list.
 */
function emptyParameters(
  source: string,
  name: string,
  span: { start: number; end: number },
): number | undefined {
  const pattern = new RegExp(`\\bfunction\\s+${name}\\s*\\(\\s*\\)`, "y");
  const text = source.slice(span.start, span.end);
  for (let index = text.indexOf("function"); index !== -1;) {
    pattern.lastIndex = index;
    const match = pattern.exec(text);
    if (match) {
      return span.start + index + match[0].indexOf("(") + 1;
    }
    index = text.indexOf("function", index + 1);
  }
  return undefined;
}

/** Just after `<Name` of an instance, checked against the source, or `undefined`. */
function afterTagName(source: string, node: ComponentNode): number | undefined {
  const open = `<${node.component}`;
  if (!source.startsWith(open, node.span.start)) {
    return undefined;
  }
  const at = node.span.start + open.length;
  return /[\s/>]/.test(source[at] ?? "") ? at : undefined;
}

/**
 * The control groups of an example, in the order of each component's first instance. A component
 * with no controllable prop gets none. A controllable prop that every instance sets is named as
 * set by the example, and every other one is a live control, with a key numbered across the
 * example, group by group, in member order. Gives none for an example the preview cannot
 * instrument.
 */
export async function exampleControls(
  source: string,
  file: string,
  root: string,
  resolver: Resolver,
  components: ReadonlyArray<CatalogueComponent>,
): Promise<Array<ExampleControlGroup>> {
  const analysis = await analyse(source, file, root, resolver, components);
  if (!analysis) {
    return [];
  }
  const order: Array<CatalogueComponent> = [];
  for (const { component } of analysis.instances) {
    if (!order.includes(component)) {
      order.push(component);
    }
  }
  const groups: Array<ExampleControlGroup> = [];
  let next = 0;
  for (const component of order) {
    if (!component.controls.length) {
      continue;
    }
    const instances = analysis.instances.filter((each) => each.component === component);
    const controls: Array<ExampleControl> = [];
    const setByExample: Array<string> = [];
    for (const control of component.controls) {
      if (instances.every((each) => each.set.has(control.name))) {
        setByExample.push(control.name);
      } else {
        controls.push({ ...control, optional: true, key: `${KEY_PREFIX}${next++}` });
      }
    }
    groups.push({
      component: component.id,
      name: component.name,
      controls,
      setByExample,
      uncontrolled: component.uncontrolled,
    });
  }
  return groups;
}

/**
 * The example with its controls bound, or `undefined` to serve it as written: when it has no live
 * control, or the analysis cannot place them. Each instance of a group's component takes
 * ` <prop>={<parameter>.<key>}` just after its tag name for each live control whose prop it leaves
 * unset, and the empty parameter list takes `<parameter>: { <key>?: <type>; … }`. Nothing adds a
 * line break, so each line keeps its number. The groups are those the preview started with: an
 * instance an edit adds gets its component's controls, and a component new to the example gets
 * none until a restart.
 */
export async function instrumentExample(
  source: string,
  file: string,
  root: string,
  resolver: Resolver,
  components: ReadonlyArray<CatalogueComponent>,
  groups: ReadonlyArray<ExampleControlGroup>,
): Promise<string | undefined> {
  if (!groups.some((group) => group.controls.length)) {
    return undefined;
  }
  const analysis = await analyse(source, file, root, resolver, components);
  if (!analysis) {
    return undefined;
  }
  const parameter = freeName(source);
  const insertions: Array<[at: number, text: string]> = [];
  const used = new Set<ExampleControl>();
  for (const instance of analysis.instances) {
    const group = groups.find((each) => each.component === instance.component.id);
    let text = "";
    for (const control of group?.controls ?? []) {
      // A prop the child no longer declares, after an edit, would fail the compile.
      if (instance.set.has(control.name) || !instance.declared.has(control.name)) {
        continue;
      }
      text += ` ${control.name}={${parameter}.${control.key}}`;
      used.add(control);
    }
    if (text) {
      insertions.push([instance.insertAt, text]);
    }
  }
  if (!used.size) {
    return undefined;
  }
  const members = groups
    .flatMap((group) => group.controls)
    .filter((control) => used.has(control))
    .map((control) => `${control.key}?: ${typeOf(control)}`);
  insertions.push([analysis.parameterAt, `${parameter}: { ${members.join("; ")} }`]);
  let result = source;
  for (const [at, text] of insertions.sort((a, b) => b[0] - a[0])) {
    result = result.slice(0, at) + text + result.slice(at);
  }
  return result;
}

/** `ufPreview`, or `ufPreview<n>` with the first `n` the source does not use. */
function freeName(source: string): string {
  const uses = (name: string) => new RegExp(`(?<![\\w$])${name}(?![\\w$])`).test(source);
  if (!uses(PARAMETER)) {
    return PARAMETER;
  }
  let index = 1;
  while (uses(`${PARAMETER}${index}`)) {
    index += 1;
  }
  return `${PARAMETER}${index}`;
}

/** A control's type, as the example's parameter declares it: one line, whatever its options. */
function typeOf(control: PropControl): string {
  if (control.kind !== "select") {
    return control.kind;
  }
  return control.options
    .map((option) =>
      JSON.stringify(option).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029"),
    )
    .join(" | ");
}

/** What the preview's servers rewrite a source file with: the unplugin's `transformSource`. */
export type SourceTransform = (file: string, source: string) => Promise<string | undefined>;

/**
 * The preview's `transformSource` for a catalogue, or `undefined` when no example has a live
 * control: it binds the controls of each example the catalogue read, and gives every other file
 * back as written. Each call reads the children's APIs afresh, as the plugin's compile does, so an
 * edit to a child is seen.
 */
export function exampleTransform(
  root: string,
  catalogue: {
    examples: ReadonlyArray<{ file: string; controls: ReadonlyArray<ExampleControlGroup> }>;
    components: ReadonlyArray<CatalogueComponent>;
  },
): SourceTransform | undefined {
  const examples = new Map(
    catalogue.examples
      .filter((example) => example.controls.some((group) => group.controls.length))
      .map((example) => [toPosix(example.file), example.controls]),
  );
  if (!examples.size) {
    return undefined;
  }
  return async (file, source) => {
    const groups = examples.get(toPosix(file));
    if (!groups) {
      return undefined;
    }
    const read = (path: string): Promise<string | undefined> =>
      readFile(path, "utf8").catch(() => undefined);
    const typeOracle = createSyntacticOracle({ root, readFile: read });
    try {
      const resolver = createFileResolver({ root, readFile: read, typeOracle });
      return await instrumentExample(source, file, root, resolver, catalogue.components, groups);
    } finally {
      await typeOracle.dispose();
    }
  };
}
