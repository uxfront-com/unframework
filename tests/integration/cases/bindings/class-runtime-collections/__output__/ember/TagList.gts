import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

type TagStates = { selected?: boolean; muted?: boolean };

export interface TagListProps {
  label: string;
  tags: string[];
  states: TagStates;
  extra?: string[];
}

export interface TagListSignature {
  Args: TagListProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class TagList extends Component<TagListSignature> {
  expand = () => {
    this.expanded = !this.expanded;
  };

  @tracked expanded = false;

  get value1() {
    return classNames("tag", this.args.tags, this.args.states, this.expanded && "tag-open");
  }

  get value2() {
    return classNames(this.args.tags);
  }

  get value3() {
    return classNames(this.args.extra, this.expanded ? ["tag-wide", "tag-tall"] : []);
  }

  <template><div
      class="tag-list"
      style={{fallthroughStyle @style}}
      ...attributes
    ><span class={{this.value1}}>{{@label}}</span><span class={{this.value2}}>Plain</span><span
      class={{this.value3}}
    >Extra</span><button type="button" {{on "click" this.expand}}>Expand</button></div></template>
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
