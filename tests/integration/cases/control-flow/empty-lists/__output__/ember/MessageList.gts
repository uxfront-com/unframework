import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface InboxMessage {
  id: string;
  subject: string;
}

export interface MessageListProps {
  messages: InboxMessage[];
  archived?: InboxMessage[];
  emptyText?: string;
}

export interface MessageListSignature {
  Args: MessageListProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class MessageList extends Component<MessageListSignature> {
  get archived() {
    return this.args.archived === undefined ? [] : this.args.archived;
  }

  get emptyText() {
    return this.args.emptyText === undefined ? "Nothing here yet." : this.args.emptyText;
  }

  get value1() {
    return this.args.messages.length === 0;
  }

  get value2() {
    return this.archived.length === 0;
  }

  get value3() {
    return !(this.archived.length === 0) ? this.archived.length : undefined;
  }

  <template><section
      class="message-list"
      aria-label="Messages"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>Inbox</h2><ul>{{#each @messages key="id" as |message|}}<li>{{message.subject}}</li>{{/each}}</ul>{{#if this.value1}}<p>{{this.emptyText}}</p>{{/if}}<h2>Archive</h2><ul>{{#each this.archived key="id" as |message|}}<li>{{message.subject}}</li>{{/each}}</ul>{{#if this.value2}}<p>No archived messages.</p>{{else}}<p>{{this.value3}} archived</p>{{/if}}</section></template>
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
