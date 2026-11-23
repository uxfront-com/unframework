import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Badge from "./Badge.gts";
import Tag from "./Tag.gts";

type NoticeLook = {
  color?: string;
  backgroundColor?: string;
  borderLeft?: string;
  "--notice-accent"?: string;
};

type NoticeVars = { "--notice-gap"?: string };

export interface NoticeProps {
  title: string;
  look?: NoticeLook;
  declarations?: string;
  vars?: NoticeVars;
}

export interface NoticeSignature {
  Args: NoticeProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class Notice extends Component<NoticeSignature> {
  toggle = () => {
    this.quiet = !this.quiet;
  };

  @tracked quiet = false;

  get value1() {
    return styleText([["", this.args.look]]);
  }

  get value2() {
    return [["", this.args.look] as const];
  }

  get value3() {
    return styleText([["", this.args.declarations]]);
  }

  get value4() {
    return this.quiet ? Tag : Badge;
  }

  get value5() {
    return [["", this.args.declarations] as const];
  }

  get value6() {
    return styleText([
      [
        "",
        this.quiet
          ? { color: "rgb(90, 90, 90)" }
          : { color: "var(--notice-accent, rgb(160, 40, 40))", fontWeight: "700" },
      ],
    ]);
  }

  get value7() {
    return this.quiet ? "Emphasise" : "Quieten";
  }

  get value8() {
    return styleText([["", this.args.vars]]);
  }

  <template><div
      class="notice"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p style={{this.value1}}>{{@title}}</p><Badge
      @label="Permanent"
      @tone="padding: 2px 6px; color: rgb(120, 30, 30); outline: 1px solid"
      @style={{this.value2}}
    /><p style={{this.value3}}>Read the details before you continue.</p>{{#if (eq this.value4 Tag)}}<Tag
      @label="Optional"
      @tone="font-weight: 700"
      @style={{this.value5}}
    />{{else}}<Badge @label="Optional" @tone="font-weight: 700" @style={{this.value5}} />{{/if}}<p
      style={{this.value6}}
    >This cannot be undone.</p><button
      type="button"
      style={{this.value8}}
      {{on "click" this.toggle}}
    >{{this.value7}}</button></div></template>
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

/**
 * A style from its declarations, those whose value is nullish left out, marked safe. A
 * declaration without a property is a whole style: a declaration list, or an object whose keys
 * may be in camel case, as Vue's `normalizeStyle` reads them.
 */
function styleText(
  declarations: readonly (readonly [string, unknown])[],
): ReturnType<typeof htmlSafe> | undefined {
  const parts: string[] = [];
  const add = (property: string, value: unknown): void => {
    if (value === undefined || value === null) return;
    if (property) parts.push(`${property}: ${String(value)}`);
    else if (typeof value === "string") parts.push(value.trim().replace(/;$/, ""));
    else if (typeof value === "object") {
      for (const [key, each] of Object.entries(value)) {
        add(
          key.startsWith("--")
            ? key
            : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          each,
        );
      }
    }
  };
  for (const [property, value] of declarations) add(property, value);
  const text = parts.filter(Boolean).join("; ");
  return text ? htmlSafe(text) : undefined;
}
