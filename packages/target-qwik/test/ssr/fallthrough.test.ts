// What falls through a component on Qwik's server (ADR-0118, ./src/fallthrough.ts): the output,
// compiled by Qwik's Vite plugin as the `ssr:qwik` project compiles it, rendered by Qwik's server
// renderer, which serialises every component's props.
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatOutput } from "@unframework.dev/codegen";
import { afterAll, describe, expect, it } from "vitest";

import target from "../../src/index.ts";
import { renderToString } from "../../src/toolchain/server.ts";
import { lower } from "../lower.ts";

/** Under the plugin's `srcDir` (the fixtures), so the optimizer compiles what is written here. */
const scratch = fileURLToPath(new URL(`../fixtures/.uf-tmp/${randomUUID()}`, import.meta.url));
mkdirSync(scratch, { recursive: true });
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** Emits every component of a source into a directory of its own and renders its default one. */
async function render(source: string): Promise<string> {
  const module = lower(source);
  const dir = join(scratch, randomUUID());
  mkdirSync(dir);
  const reported: unknown[] = [];
  for (const component of module.components) {
    const files = target.emit(component, {
      module,
      options: undefined,
      report: (diagnostic) => void reported.push(diagnostic),
    });
    for (const file of files) {
      const formatted = await formatOutput(file);
      writeFileSync(join(dir, formatted.file.path), formatted.file.contents);
    }
  }
  expect(reported).toEqual([]);
  const main = module.components.find((component) =>
    module.exports.some((entry) => entry.kind === "default" && entry.local === component.name),
  )!;
  const loaded: { default: unknown } = await import(join(dir, `${main.name}.tsx`));
  return renderToString(loaded.default, {});
}

const base = `function Base({ text }: { text: string }) {
  return <button type="button">{text}</button>;
}`;

describe("a root component with the component's own template ref, on Qwik's server", () => {
  it("renders, without a consumer's ref", async () => {
    const html = await render(`import { onMounted, useTemplateRef } from "@uxfront/unframework";

export default function Page() {
  return <div><Primary text="go" /></div>;
}

function Primary({ text }: { text: string }) {
  const own = useTemplateRef<HTMLButtonElement>();
  onMounted(() => own.value?.setAttribute("data-mounted", ""));
  return <Base ref={own} text={text} />;
}

${base}`);
    expect(html).toMatch(/<button [^>]*type="button"[^>]*>go<\/button>/);
  });

  it("renders with a consumer's ref, which the root component takes", async () => {
    const html =
      await render(`import { onMounted, ref, useTemplateRef } from "@uxfront/unframework";

export default function Page() {
  const save = useTemplateRef<HTMLButtonElement>();
  const seen = ref("");
  onMounted(() => (seen.value = save.value?.id ?? ""));
  return <div><Primary ref={save} text="go" id="save" /><p>{seen.value}</p></div>;
}

function Primary({ text }: { text: string }) {
  const own = useTemplateRef<HTMLButtonElement>();
  onMounted(() => own.value?.setAttribute("data-mounted", ""));
  return <Base ref={own} text={text} />;
}

${base}`);
    expect(html).toMatch(/<button [^>]*id="save"[^>]*>go<\/button>/);
  });
});
