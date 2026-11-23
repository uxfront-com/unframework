import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

export interface NoticeSignature {
  Args: NoticeProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Notice extends Component<NoticeSignature> {
  get title() {
    return this.args.title === undefined ? "Notice" : this.args.title;
  }

  get tone() {
    return this.args.tone === undefined ? "info" : this.args.tone;
  }

  get priority() {
    return this.args.priority === undefined ? 1 : this.args.priority;
  }

  get expanded() {
    return this.args.expanded === undefined ? false : this.args.expanded;
  }

  get tags() {
    return this.args.tags === undefined ? ["general"] : this.args.tags;
  }

  get author() {
    return this.args.author === undefined ? { name: "System" } : this.args.author;
  }

  get value1() {
    return this.tags.join(", ");
  }

  <template><section
      class="notice"
      aria-label={{this.title}}
      data-tone={{this.tone}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>{{this.title}}</h2><p>{{@message}}</p><details
      open={{this.expanded}}
    ><summary>Priority {{this.priority}}</summary><p>Tagged {{this.value1}}, posted by {{this.author.name}}.</p></details></section></template>
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
