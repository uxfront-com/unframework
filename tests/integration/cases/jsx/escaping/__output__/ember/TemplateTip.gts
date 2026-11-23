import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface TemplateTipProps {
  example: string;
  note: string;
  path: string;
}

export interface TemplateTipSignature {
  Args: TemplateTipProps & { style?: unknown };
  Element: HTMLElementTagNameMap["figure"];
}

export default class TemplateTip extends Component<TemplateTipSignature> {
  get value1() {
    return this.args.path + "\\index.ts";
  }

  get value2() {
    return "{{ " + this.args.path + " }}";
  }

  <template><figure
      class="template-tip"
      style={{fallthroughStyle @style}}
      ...attributes
    ><figcaption
      title="Vue \{{ name }}, Svelte {#if ok}, Angular @if (ok) &amp; JSX {name}"
    >Template syntax &amp; escaping</figcaption><pre><code>{{@example}}</code></pre><p
      data-sample="<b> &quot;double&quot; 'single' C:\temp"
    >Static: &lt;b>not bold&lt;/b>, \{{ name }}, @if (ok) { }</p><p>Literal: \{{ name }} &lt;i>not italic&lt;/i> {#each items} @for "quoted" C:\temp café</p><p
      title="Say &quot;hi&quot; &amp; wave"
    >Quoted attribute</p><p
      title={{@note}}
      data-path={{@path}}
    >Bound: {{@note}} in {{this.value1}}</p><p>Mustache: {{this.value2}}</p><p>Done &amp;check;</p></figure></template>
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
