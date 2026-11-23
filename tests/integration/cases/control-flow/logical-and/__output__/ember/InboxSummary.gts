import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface InboxSummaryProps {
  folder: string;
  unread: number;
  flagged: number;
  signature: string;
}

export interface InboxSummarySignature {
  Args: InboxSummaryProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class InboxSummary extends Component<InboxSummarySignature> {
  get value1() {
    return this.args.folder || "Inbox";
  }

  get value2() {
    return this.args.unread > 0 && this.args.flagged > 0;
  }

  <template><section
      class="inbox-summary"
      aria-label="Inbox summary"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>{{this.value1}}</h2>{{#if @unread}}<p>{{@unread}} unread</p>{{/if}}{{#if @flagged}}<p>{{@flagged}} flagged</p>{{/if}}{{#if this.value2}}<p>Some unread messages are flagged.</p>{{/if}}{{#if @folder}}<p>Filed under {{@folder}}</p>{{/if}}{{#if @signature}}<p
      class="inbox-signature"
    >{{@signature}}</p>{{/if}}</section></template>
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
