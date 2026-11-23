import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

interface LogLine {
  id: string;
  text: string;
}

export interface BuildLogProps {
  target: string;
  failed: boolean;
  lines?: LogLine[] | null;
  warnings?: string[];
}

export interface BuildLogSignature {
  Args: BuildLogProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class BuildLog extends Component<BuildLogSignature> {
  get value1() {
    return this.args.lines ?? [];
  }

  get value2() {
    return this.args.warnings ?? [];
  }

  <template><section
      class="build-log"
      aria-label="Build log"
      style={{fallthroughStyle @style}}
      ...attributes
    ><pre>$ make {{@target}}{{#if @failed}}<strong> (failed)</strong>{{/if}}&#10;{{#each this.value1 key="id" as |line|}}<code>{{line.text}}
</code>{{/each}}</pre><ul
      aria-label="Warnings"
    >{{#each this.value2 key="@identity" as |warning|}}<li>{{warning}}</li>{{/each}}</ul></section></template>
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
