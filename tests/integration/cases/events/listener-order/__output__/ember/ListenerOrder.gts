import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface ListenerOrderSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class ListenerOrder extends Component<ListenerOrderSignature> {
  record = (line: string) => {
    this.log = [...this.log, line];
  };

  @tracked log: string[] = [];

  @tracked resets = 0;

  listener1 = () => this.record("save");

  listener2 = () => this.record("first save");

  listener3 = () => this.record("first send");

  listener4 = () => this.record("send");

  listener5 = () => this.record("reset");

  listener6 = () => (this.resets += 1);

  listener7 = () => this.record("toolbar");

  listener8 = () => this.record("inside");

  listener9 = () => this.record("panel capture");

  listener10 = (event: HTMLElementEventMap["click"]) => {
    event.stopPropagation();
    this.record("panel bubble");
  };

  listener11 = () => this.record("outside");

  listener12 = (event: HTMLElementEventMap["click"]) => {
    event.stopPropagation();
    this.record("stopped");
  };

  listener13 = () => this.record("pass");

  listener14 = () => this.record("claim once");

  listener15 = () => this.record("inner wheel");

  listener16 = () => this.record("outer wheel");

  <template><section
      class="listener-order"
      aria-label="Listener order"
      style={{fallthroughStyle @style}}
      ...attributes
    ><div
      class="toolbar"
      role="presentation"
      {{on "click" this.listener7}}
    ><button
      type="button"
      {{on "click" this.listener1}}
      {{on "click" this.listener2 once=true}}
    >Save</button><button
      type="button"
      {{on "click" this.listener3 once=true}}
      {{on "click" this.listener4}}
    >Send</button><button
      type="button"
      {{on "click" this.listener5}}
      {{on "click" this.listener6 once=true}}
    >Reset</button></div><div
      class="panel"
      role="presentation"
      {{on "click" this.listener9 capture=true}}
      {{on "click" this.listener10}}
    ><button type="button" {{on "click" this.listener8}}>Inside</button></div><button
      type="button"
      {{on "click" this.listener11}}
    >Outside</button><div
      class="claim"
      role="presentation"
      {{on "click" this.listener14 once=true}}
    ><button type="button" {{on "click" this.listener12}}>Stop</button><button
      type="button"
      {{on "click" this.listener13}}
    >Pass</button></div><div
      class="outer-zone"
      role="group"
      aria-label="Outer zone"
      {{on "wheel" this.listener16}}
    ><div
      class="inner-zone"
      role="group"
      aria-label="Inner zone"
      {{on "wheel" this.listener15 passive=true}}
    >Scroll here</div></div><p>Resets: {{this.resets}}</p><ol
      aria-label="Log"
    >{{#each this.log key="@index" as |entry|}}<li>{{entry}}</li>{{/each}}</ol></section></template>
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
