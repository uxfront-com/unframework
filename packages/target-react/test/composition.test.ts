// Composition as the React target writes it (ADR-0054): controllable models, slots as props and
// render props, a forwarded default slot as children, context, `<component is>` and the root's
// `className` and `style`. Each test lowers a source with the analyser and pins the shapes that
// matter, so a change shows here as well as in the corpus' goldens.
import { formatOutput } from "@unframework/codegen";
import { describe, expect, it } from "vitest";

import { analyze } from "../../analyzer/src/index.ts";
import { parseModule } from "../../parser/src/index.ts";
import target from "../src/index.ts";

/** The formatted React output of each component of a source, by component name. */
async function outputs(source: string): Promise<Map<string, string>> {
  const { module, diagnostics } = analyze(parseModule("Fixture.uf.tsx", source));
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity !== "warning");
  if (!module || errors.length) {
    const messages = errors.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`);
    throw new Error(`The analyser rejected the fixture:\n${messages.join("\n")}`);
  }
  const files = new Map<string, string>();
  for (const component of module.components) {
    const reported: unknown[] = [];
    const [file] = target.emit(component, {
      module,
      options: undefined,
      report: (diagnostic) => void reported.push(diagnostic),
    });
    expect(reported).toEqual([]);
    const outcome = await formatOutput(file!);
    expect(outcome.error).toBeUndefined();
    files.set(component.name, outcome.file.contents);
  }
  return files;
}

describe("react composition", () => {
  it("keeps a written model's local state while it is unbound, and calls back on a write", async () => {
    const files = await outputs(`import { defineModel } from "unframework";
export default function Toggle() {
  const on = defineModel<boolean>("on", { default: false });
  return <button type="button" onClick={() => (on.value = !on.value)}>{on.value ? "On" : "Off"}</button>;
}`);
    const toggle = files.get("Toggle")!;
    expect(toggle).toContain("export interface ToggleModels {\n  on?: boolean;");
    expect(toggle).toContain("onOnChange?: (on: boolean) => void;");
    expect(toggle).toContain("const [localOn, setLocalOn] = useState<boolean>(false);");
    expect(toggle).toContain("const on = onProp === undefined ? localOn : onProp;");
    expect(toggle).toContain(
      "onRef.current = !onRef.current;\n        setLocalOn(onRef.current);\n        onOnChange?.(onRef.current);",
    );
  });

  it("destructures a model nothing writes with its default", async () => {
    const files = await outputs(`import { defineModel } from "unframework";
export default function Gauge() {
  const level = defineModel<number>("value", { default: 3 });
  return <meter value={level.value} />;
}`);
    expect(files.get("Gauge")).toContain("value: level = 3,");
    expect(files.get("Gauge")).toContain("<meter value={level}");
  });

  it("binds a child's model to state through its setter", async () => {
    const files = await outputs(`import { defineModel, ref } from "unframework";
function Stepper() {
  const value = defineModel<number>("value", { default: 0 });
  return <button type="button" onClick={() => (value.value += 1)}>{value.value}</button>;
}
export default function Order() {
  const cups = ref(2);
  return <section><Stepper v-model:value={cups.value} /><output>{cups.value}</output></section>;
}`);
    expect(files.get("Order")).toContain("<Stepper value={cups} onValueChange={setCups} />");
  });

  it("passes slots as props and render props, and a forwarded default slot as children", async () => {
    const files = await outputs(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
function Box() {
  const slots = defineSlots<{ default?(): Element; item?(props: { n: number }): Element }>();
  return <div>{slots.default?.() ?? "Empty"}{slots.item?.({ n: 1 })}</div>;
}
export default function Frame() {
  const slots = defineSlots<{ default?(): Element }>();
  return <Box>{{ default: slots.default, item: ({ n }) => <b>{n}</b> }}</Box>;
}`);
    const box = files.get("Box")!;
    expect(box).toContain("children?: ReactNode;");
    expect(box).toContain("renderItem?: (props: { n: number }) => ReactNode;");
    expect(box).toContain('{children ?? "Empty"}');
    expect(box).toContain("{renderItem?.({ n: 1 })}");
    expect(files.get("Frame")).toContain(
      "<Box className={className} style={style} renderItem={({ n }) => <b>{n}</b>}>\n      {children}\n    </Box>",
    );
  });

  it("tests a slot's presence by its prop", async () => {
    const files = await outputs(`import { defineSlots } from "unframework";
import type { Element } from "unframework";
export default function Card() {
  const slots = defineSlots<{ title?(): Element }>();
  return <section>{slots.title ? <header>{slots.title?.()}</header> : <p>Untitled</p>}</section>;
}`);
    expect(files.get("Card")).toContain(
      "{title != null ? <header>{title}</header> : <p>Untitled</p>}",
    );
  });

  it("declares a key as a context, provides it around the template and reads it with use", async () => {
    const files = await outputs(`import { inject, provide } from "unframework";
import type { InjectionKey } from "unframework";
export const LocaleKey: InjectionKey<string> = Symbol("uf.locale");
function Greeting() {
  const locale = inject(LocaleKey, "en");
  return <p>{locale}</p>;
}
export default function Page() {
  provide(LocaleKey, "pt");
  return <main><Greeting /></main>;
}`);
    const page = files.get("Page")!;
    expect(page).toContain(
      "export const LocaleKey = createContext<string | undefined>(undefined);",
    );
    expect(page).toContain('const [localeValue] = useState("pt");');
    expect(page).toContain("<LocaleKey value={localeValue}>");
    expect(files.get("Greeting")).toContain('const locale = use(LocaleKey) ?? "en";');
  });

  it("renders <component is> through a const the body declares", async () => {
    const files =
      await outputs(`export default function Heading({ level }: { level: "h2" | "h3" }) {
  return <component is={level} class="title">Hi</component>;
}`);
    const heading = files.get("Heading")!;
    expect(heading).toContain("const Tag = level;");
    expect(heading).toContain('<Tag className="title">Hi</Tag>');
  });

  it("merges a consumer's class and style into the root, the consumer's style last", async () => {
    const files = await outputs(`export default function Tag({ label }: { label: string }) {
  return <span class="tag" style="color: red">{label}</span>;
}`);
    const tag = files.get("Tag")!;
    expect(tag).toContain(
      "export interface TagAttributes {\n  className?: string;\n  style?: CSSProperties;\n}",
    );
    expect(tag).toContain('className={cx("tag", className)}');
    expect(tag).toContain('style={{ color: "red", ...style }}');
  });

  it("names each component's helpers apart where a source's components are joined", async () => {
    const files = await outputs(`export function Badge({ on }: { on: boolean }) {
  return <span class={{ on }}>Badge</span>;
}
export function Pill({ on }: { on: boolean }) {
  return <span class={{ on }}>Pill</span>;
}`);
    expect(files.get("Badge")).toContain("function cx(");
    expect(files.get("Pill")).toContain("function cx_1(");
  });
});
