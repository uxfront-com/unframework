import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

export interface DraftNoticeSignature {
  Args: DraftNoticeProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class DraftNotice extends Component<DraftNoticeSignature> {
  get value1() {
    return `${this.args.author}'s avatar`;
  }

  get value2() {
    return this.args.saved ? "Saved" : 'Not "saved" yet';
  }

  get value3() {
    return this.args.saved ? "Saved" : "Don't forget to save";
  }

  get value4() {
    return this.args.saved
      ? `${this.args.author}'s draft is safe.`
      : `${this.args.author} says: "I'll save it later."`;
  }

  get value5() {
    return this.args.saved
      ? "Nothing to save"
      : `Press "Save" to keep ${this.args.author}'s changes`;
  }

  <template><section
      class="draft-notice"
      aria-label="Draft"
      style={{fallthroughStyle @style}}
      ...attributes
    ><img
      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
      alt={{this.value1}}
      width="32"
      height="32"
    ><p title={{this.value3}}>{{this.value2}}</p><p title={{this.value5}}>{{this.value4}}</p></section></template>
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
