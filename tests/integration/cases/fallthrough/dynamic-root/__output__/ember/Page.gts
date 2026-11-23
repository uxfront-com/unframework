import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Base, { type BaseEvents } from "./Base.gts";
import Primary, { type PrimaryEvents } from "./Primary.gts";
import "./Page.uf.tsx.css";

export interface PageSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Page extends Component<PageSignature> {
  @tracked linked = true;

  @tracked tone = "rgb(29, 78, 216)";

  @tracked pressed = "none";

  @tracked items = [
    { id: 1, href: "#one", disabled: true, label: "One" },
    { id: 2, href: "", disabled: true, label: "Two" },
  ];

  get value1() {
    return this.linked ? "#docs" : undefined;
  }

  listener1 = (() => (this.pressed = "docs")) satisfies NonNullable<PrimaryEvents["onPress"]>;

  get value2() {
    return [["color", this.tone] as const];
  }

  listener2 = (() => (this.pressed = "off")) satisfies NonNullable<BaseEvents["onPress"]>;

  get value3() {
    return classNames("off", !this.linked && "muted");
  }

  listener3 = (() => (this.pressed = "save")) satisfies NonNullable<BaseEvents["onPress"]>;

  value4 = (item: NonNullable<this["items"]>[number]) => (item.href ? "a" : "button");

  listener4 = () => {
    this.linked = !this.linked;
    this.tone = this.linked ? "rgb(29, 78, 216)" : "rgb(21, 128, 61)";
  };

  <template><section
      class="page"
      data-uf-64cf7c28=""
      style={{fallthroughStyle @style}}
      ...attributes
    ><Primary
      @href={{this.value1}}
      @disabled={{true}}
      @text="Docs"
      @onPress={{this.listener1}}
      class="wide"
      @style={{this.value2}}
      data-uf-64cf7c28=""
    /><Base
      @disabled={{true}}
      @text="Off"
      @onPress={{this.listener2}}
      class={{this.value3}}
      data-uf-64cf7c28=""
    /><Base @text="Save" @onPress={{this.listener3}} class="save" data-uf-64cf7c28="" /><ul
      aria-label="Items"
      data-uf-64cf7c28=""
    >{{#each this.items key="id" as |item|}}<li
      data-uf-64cf7c28=""
    >{{#if (eq (this.value4 item) "a")}}<a
      href={{item.href}}
      class="item"
      data-uf-64cf7c28=""
    >{{item.label}}</a>{{else}}<button
      disabled={{item.disabled}}
      class="item"
      data-uf-64cf7c28=""
    >{{item.label}}</button>{{/if}}</li>{{/each}}</ul><button
      type="button"
      {{on "click" this.listener4}}
      data-uf-64cf7c28=""
    >Toggle</button><output data-uf-64cf7c28="">{{this.pressed}}</output></section></template>
}

/** A class as clsx builds it: strings, arrays and toggle objects, empty tokens left out. */
function classNames(...values: unknown[]): string | undefined {
  const tokens: string[] = [];
  const add = (value: unknown): void => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") tokens.push(String(value));
    else if (Array.isArray(value)) for (const each of value) add(each);
    else if (typeof value === "object") {
      for (const [name, on] of Object.entries(value)) if (on) tokens.push(name);
    }
  };
  for (const value of values) add(value);
  return tokens.length ? tokens.join(" ") : undefined;
}

/**
 * Vue's merge of a caller's style into the root's, marked safe: each style's declarations in
 * order, where a later value of a property replaces an earlier one, and a nullish one removes it.
 * A style is text, or a list of `[property, value]` declarations, where one without a property
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
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          value,
        );
      }
    } else {
      const text = String(style).replace(/\/\*[^]*?\*\//g, "");
      for (const declaration of text.split(/;(?![^(]*\))/)) {
        const [property, value] = declaration.split(/:([^]+)/);
        if (property?.trim() && value?.trim()) merged.set(property.trim(), value.trim());
      }
    }
  };
  for (const style of styles) add(style);
  const text = Array.from(merged)
    .flatMap(([property, value]) =>
      value === undefined || value === null ? [] : [`${property}: ${String(value)}`],
    )
    .join("; ");
  return text ? htmlSafe(text) : undefined;
}
