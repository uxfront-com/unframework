import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface EventLogSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class EventLog extends Component<EventLogSignature> {
  record = (line: string) => {
    this.log = [...this.log, line];
  };

  changeVolume = (event: WheelEvent) => {
    if (event.deltaY < 0) {
      this.volume += 1;
    } else {
      this.volume -= 1;
    }
  };

  @tracked log: string[] = [];

  @tracked volume = 5;

  listener1 = () => this.record("button");

  listener2 = (event: HTMLElementEventMap["click"]) => {
    event.stopPropagation();
    this.record("stopped");
  };

  listener3 = () => this.record("panel capture");

  listener4 = () => this.record("panel bubble");

  listener5 = () => this.record("once");

  listener6 = (event: HTMLElementEventMap["click"]) => {
    event.stopPropagation();
    this.record("claimed");
  };

  listener7 = () => this.record("outer");

  <template><section
      class="event-log"
      aria-label="Event options"
      style={{fallthroughStyle @style}}
      ...attributes
    ><div
      class="panel"
      role="presentation"
      {{on "click" this.listener3 capture=true}}
      {{on "click" this.listener4}}
    ><button type="button" {{on "click" this.listener1}}>Inside</button><button
      type="button"
      {{on "click" this.listener2}}
    >Stop here</button></div><button
      type="button"
      {{on "click" this.listener5 once=true}}
    >Only once</button><div
      class="reward"
      role="presentation"
      {{on "click" this.listener7}}
    ><button type="button" {{on "click" this.listener6 once=true}}>Claim the reward</button></div><div
      class="volume"
      role="group"
      aria-label="Volume"
      {{on "wheel" this.changeVolume passive=true}}
    ><output>{{this.volume}}</output></div><ol
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
