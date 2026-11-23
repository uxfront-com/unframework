import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

interface Row {
  id: number;
  label: string;
}

export interface PanelSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Panel extends Component<PanelSignature> {
  addExtra = () => {
    this.extras = [...this.extras, `Extra ${this.extras.length + 1}`];
  };

  @tracked note = false;

  @tracked extras: string[] = [];

  @tracked rows: Row[] = [
    { id: 1, label: "Alpha" },
    { id: 2, label: "Beta" },
  ];

  listener1 = () => (this.note = true);

  listener2 = () => (this.rows = [...this.rows].reverse());

  <template><section
      class="panel"
      aria-label="Panel"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" {{on "click" this.listener1}}>Show note</button><button
      type="button"
      {{on "click" this.addExtra}}
    >Add extra</button><button type="button" {{on "click" this.listener2}}>Reverse rows</button>{{#if this.note}}<p
      class="note"
    >Note</p>{{/if}}{{#each this.extras key="@identity" as |extra|}}<span>{{extra}}</span>{{/each}}{{#let (teleportTarget "body") as |target|}}{{#if target}}{{#in-element target insertBefore=null}}<div
      data-teleported="true"
      class="first"
    >First</div>{{/in-element}}{{/if}}{{/let}}{{#let (teleportTarget "body") as |target|}}{{#if target}}{{#in-element target insertBefore=null}}<div
      data-teleported="true"
      class="second"
    >Second</div>{{/in-element}}{{/if}}{{/let}}<ul>{{#each this.rows key="id" as |row|}}<li>{{row.label}}{{#let (teleportTarget "body") as |target|}}{{#if target}}{{#in-element target insertBefore=null}}<p
      data-teleported="true"
      class="tip"
    >{{row.label}} tip</p>{{/in-element}}{{/if}}{{/let}}</li>{{/each}}</ul></section></template>
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

/** The element a `<Teleport to>` selects, in the browser only: the server renders no teleport. */
function teleportTarget(to: string): Element | undefined {
  return import.meta.env.SSR ? undefined : (document.querySelector(to) ?? undefined);
}
