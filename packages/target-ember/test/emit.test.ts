import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// The compiler is no dependency of a target (plan §5.2): tests reach it from its source.
import { compile } from "../../compiler/src/index.ts";
import { renderToString } from "../src/toolchain/server.ts";

const scratch = join(import.meta.dirname, ".scratch");
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** The diagnostics' codes and the Ember files of one `.uf.tsx` source. */
async function emberOf(source: string) {
  const result = await compile(source, { filename: "Card.uf.tsx", targets: ["ember"] });
  return {
    codes: result.diagnostics.map((diagnostic) => `${diagnostic.code} ${diagnostic.severity}`),
    files: result.outputs.ember ?? [],
  };
}

/** Renders the one `.gts` file a source compiles to on the server, with props. */
async function render(source: string, props: Record<string, unknown>): Promise<string> {
  const { files } = await emberOf(source);
  const [file] = files;
  if (!file) throw new Error("The source compiled to no Ember file.");
  const directory = join(scratch, String(Math.random()).slice(2));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, file.path), file.contents);
  const module = (await import(join(directory, file.path))) as { default: unknown };
  return renderToString(module.default, { props });
}

describe("ember target", () => {
  it("writes a component with nothing of its own as a template-only component", async () => {
    const { files } = await emberOf(`
      export default function Card({ title }: { title: string }) {
        return <h2 class="card">{title}</h2>;
      }
    `);
    expect(files.map((file) => file.contents).join("")).toMatchInlineSnapshot(`
      "import type { TOC } from "@ember/component/template-only";
      import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

      export interface CardSignature {
        Args: { title: string } & { style?: unknown };
        Element: HTMLElementTagNameMap["h2"];
      }

      const Card: TOC<CardSignature> = <template><h2 class="card" style={{fallthroughStyle @style}} ...attributes>{{@title}}</h2></template>;

      export default Card;

      /**
       * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
       * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
       * A style is text, or a list of \`[property, value]\` declarations, where one without a property
       * is a whole style.
       */
      function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
        const merged = new Map<string, unknown>();
        const add = (style: unknown): void => {
          if (style === undefined || style === null) return;
          if (Array.isArray(style)) {
            for (const [property, value] of style as [string, unknown][]) {
              if (property) merged.set(property, value);
              else add(value);
            }
          } else if (typeof style === "object" && !isHTMLSafe(style)) {
            for (const [key, value] of Object.entries(style)) {
              merged.set(
                key.startsWith("--")
                  ? key
                  : key.replace(/[A-Z]/g, (letter) => \`-\${letter.toLowerCase()}\`),
                value,
              );
            }
          } else {
            const text = String(style).replace(/\\/\\*[^]*?\\*\\//g, "");
            for (const declaration of text.split(/;(?![^(]*\\))/)) {
              const [property, value] = declaration.split(/:([^]+)/);
              if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
            }
          }
        };
        for (const style of styles) add(style);
        const text = Array.from(merged)
          .flatMap(([property, value]) =>
            value === undefined || value === null ? [] : [\`\${property}: \${String(value)}\`],
          )
          .join("; ");
        return text ? htmlSafe(text) : undefined;
      }
      "
    `);
  });

  it("reads each expression a template cannot hold through a member, a row's through its variable", async () => {
    const { files } = await emberOf(`
      export interface Item { id: string; label: string; done: boolean }
      export default function Card({ items, heading = "Tasks" }: { items: Item[]; heading?: string }) {
        return (
          <section aria-label={heading}>
            <ul>
              {items.map((item) => (
                <li key={item.id} aria-checked={item.done}>{item.label.toUpperCase()}</li>
              ))}
            </ul>
          </section>
        );
      }
    `);
    expect(files.map((file) => file.contents).join("")).toMatchInlineSnapshot(`
      "import Component from "@glimmer/component";
      import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

      export interface Item {
        id: string;
        label: string;
        done: boolean;
      }

      export interface CardSignature {
        Args: { items: Item[]; heading?: string } & { style?: unknown };
        Element: HTMLElementTagNameMap["section"];
      }

      export default class Card extends Component<CardSignature> {
        get heading() {
          return this.args.heading === undefined ? "Tasks" : this.args.heading;
        }

        value1 = (item: NonNullable<this["args"]["items"]>[number]) => item.label.toUpperCase();

        <template><section
            aria-label={{this.heading}}
            style={{fallthroughStyle @style}}
            ...attributes
          ><ul>{{#each @items key="id" as |item|}}<li
            aria-checked={{enumeratedValue item.done}}
          >{{this.value1 item}}</li>{{/each}}</ul></section></template>
      }

      /** An enumerated attribute's value: a boolean as its name, any other value as it is. */
      function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
        return typeof value === "boolean"
          ? (String(value) as "true" | "false")
          : (value as Exclude<T, boolean>);
      }

      /**
       * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
       * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
       * A style is text, or a list of \`[property, value]\` declarations, where one without a property
       * is a whole style.
       */
      function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
        const merged = new Map<string, unknown>();
        const add = (style: unknown): void => {
          if (style === undefined || style === null) return;
          if (Array.isArray(style)) {
            for (const [property, value] of style as [string, unknown][]) {
              if (property) merged.set(property, value);
              else add(value);
            }
          } else if (typeof style === "object" && !isHTMLSafe(style)) {
            for (const [key, value] of Object.entries(style)) {
              merged.set(
                key.startsWith("--")
                  ? key
                  : key.replace(/[A-Z]/g, (letter) => \`-\${letter.toLowerCase()}\`),
                value,
              );
            }
          } else {
            const text = String(style).replace(/\\/\\*[^]*?\\*\\//g, "");
            for (const declaration of text.split(/;(?![^(]*\\))/)) {
              const [property, value] = declaration.split(/:([^]+)/);
              if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
            }
          }
        };
        for (const style of styles) add(style);
        const text = Array.from(merged)
          .flatMap(([property, value]) =>
            value === undefined || value === null ? [] : [\`\${property}: \${String(value)}\`],
          )
          .join("; ");
        return text ? htmlSafe(text) : undefined;
      }
      "
    `);
  });

  it("reads an expression a branch narrows under that branch's condition", async () => {
    const { files } = await emberOf(`
      export default function Card({ count }: { count?: number }) {
        return <p>{count !== undefined ? <b>{count.toFixed(1)}</b> : "None"}</p>;
      }
    `);
    expect(files.map((file) => file.contents).join("")).toMatchInlineSnapshot(`
      "import Component from "@glimmer/component";
      import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

      export interface CardSignature {
        Args: { count?: number } & { style?: unknown };
        Element: HTMLElementTagNameMap["p"];
      }

      export default class Card extends Component<CardSignature> {
        get value1() {
          return this.args.count !== undefined;
        }

        get value2() {
          return this.args.count !== undefined ? this.args.count.toFixed(1) : undefined;
        }

        <template><p
            style={{fallthroughStyle @style}}
            ...attributes
          >{{#if this.value1}}<b>{{this.value2}}</b>{{else}}None{{/if}}</p></template>
      }

      /**
       * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
       * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
       * A style is text, or a list of \`[property, value]\` declarations, where one without a property
       * is a whole style.
       */
      function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
        const merged = new Map<string, unknown>();
        const add = (style: unknown): void => {
          if (style === undefined || style === null) return;
          if (Array.isArray(style)) {
            for (const [property, value] of style as [string, unknown][]) {
              if (property) merged.set(property, value);
              else add(value);
            }
          } else if (typeof style === "object" && !isHTMLSafe(style)) {
            for (const [key, value] of Object.entries(style)) {
              merged.set(
                key.startsWith("--")
                  ? key
                  : key.replace(/[A-Z]/g, (letter) => \`-\${letter.toLowerCase()}\`),
                value,
              );
            }
          } else {
            const text = String(style).replace(/\\/\\*[^]*?\\*\\//g, "");
            for (const declaration of text.split(/;(?![^(]*\\))/)) {
              const [property, value] = declaration.split(/:([^]+)/);
              if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
            }
          }
        };
        for (const style of styles) add(style);
        const text = Array.from(merged)
          .flatMap(([property, value]) =>
            value === undefined || value === null ? [] : [\`\${property}: \${String(value)}\`],
          )
          .join("; ");
        return text ? htmlSafe(text) : undefined;
      }
      "
    `);
  });

  it("emits a listener as `{{on}}` with a member that holds its handler", async () => {
    const { codes, files } = await emberOf(`
      import { ref } from "@uxfront/unframework";
      export default function Counter() {
        const count = ref(0);
        return <button type="button" onClick={() => count.value++}>{count.value}</button>;
      }
    `);
    expect(codes).toEqual([]);
    expect(files[0]?.contents).toMatchInlineSnapshot(`
      "import Component from "@glimmer/component";
      import { tracked } from "@glimmer/tracking";
      import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

      export interface CounterSignature {
        Args: { style?: unknown };
        Element: HTMLElementTagNameMap["button"];
      }

      export default class Counter extends Component<CounterSignature> {
        @tracked count = 0;

        listener1 = () => this.count++;

        <template><button
            type="button"
            {{on "click" this.listener1}}
            style={{fallthroughStyle @style}}
            ...attributes
          >{{this.count}}</button></template>
      }

      /**
       * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
       * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
       * A style is text, or a list of \`[property, value]\` declarations, where one without a property
       * is a whole style.
       */
      function fallthroughStyle(...styles: unknown[]): SafeString | undefined {
        const merged = new Map<string, unknown>();
        const add = (style: unknown): void => {
          if (style === undefined || style === null) return;
          if (Array.isArray(style)) {
            for (const [property, value] of style as [string, unknown][]) {
              if (property) merged.set(property, value);
              else add(value);
            }
          } else if (typeof style === "object" && !isHTMLSafe(style)) {
            for (const [key, value] of Object.entries(style)) {
              merged.set(
                key.startsWith("--")
                  ? key
                  : key.replace(/[A-Z]/g, (letter) => \`-\${letter.toLowerCase()}\`),
                value,
              );
            }
          } else {
            const text = String(style).replace(/\\/\\*[^]*?\\*\\//g, "");
            for (const declaration of text.split(/;(?![^(]*\\))/)) {
              const [property, value] = declaration.split(/:([^]+)/);
              if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
            }
          }
        };
        for (const style of styles) add(style);
        const text = Array.from(merged)
          .flatMap(([property, value]) =>
            value === undefined || value === null ? [] : [\`\${property}: \${String(value)}\`],
          )
          .join("; ");
        return text ? htmlSafe(text) : undefined;
      }
      "
    `);
  });

  it("applies a directive as a modifier that its output declares", async () => {
    const { codes, files } = await emberOf(`
      import { defineDirective } from "@uxfront/unframework";
      const vMark = defineDirective<string>({
        mounted(el, value) {
          el.dataset.mark = value;
        },
      });
      export default function Card() {
        return <p v-mark="seen">Hi</p>;
      }
    `);
    expect(codes).toEqual([]);
    const [file] = files;
    expect(file?.contents).toContain("const vMark = directive<string, HTMLElement>({");
    expect(file?.contents).toContain(
      '<p {{vMark "seen"}} style={{fallthroughStyle @style}} ...attributes>Hi</p>',
    );
  });

  it("emits nothing for a component that provides without a root element", async () => {
    const { codes, files } = await emberOf(`
      import { provide } from "@uxfront/unframework";
      import type { InjectionKey } from "@uxfront/unframework";
      export const ToneKey: InjectionKey<string> = Symbol("tone");
      export default function Card() {
        provide(ToneKey, "calm");
        return (
          <>
            <p>One</p>
            <p>Two</p>
          </>
        );
      }
    `);
    expect(codes).toEqual(["UF4001 error"]);
    expect(files).toEqual([]);
  });

  it("renders on the server what the source renders", async () => {
    const html = await render(
      `
      export default function Card({ tone = "info", tags }: { tone?: string; tags: string[] }) {
        return (
          <p class={["card", { muted: tone === "muted" }]} data-tone={tone} aria-busy={tags.length > 2}>
            {tags.join(", ")}
          </p>
        );
      }
    `,
      { tags: ["a", "b"], tone: "muted" },
    );
    expect(html).toMatchInlineSnapshot(
      `"<!--%+b:0%--><!--%+b:1%--><!--%+b:2%--><!--%+b:3%--><!--%+b:4%--><!--%+b:5%--><!--%+b:6%--><!--%+b:7%--><!--%+b:8%--><!--%+b:9%--><p class="card muted" data-tone="muted" aria-busy="false"><!--%+b:10%-->a, b<!--%-b:10%--></p><!--%-b:9%--><!--%-b:8%--><!--%-b:7%--><!--%-b:6%--><!--%-b:5%--><!--%-b:4%--><!--%-b:3%--><!--%-b:2%--><!--%-b:1%--><!--%-b:0%-->"`,
    );
  });
});
