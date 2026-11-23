import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { renderSettled } from "@ember/renderer";

export interface PickerEvents {
  onDone?: (step: number, status: string) => void;
}

export interface PickerSignature {
  Args: { style?: unknown } & PickerEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class Picker extends Component<PickerSignature> {
  record = (line: string) => {
    this.log = [...this.log, line];
  };

  pick = (name: string) => {
    this.selected = name;
    this.hits += 1;
  };

  report = () => {
    this.record(`picked ${this.selected} #${this.hits}`);
  };

  load = async () => {
    this.status = "loading";
    await Promise.resolve();
    this.step += 1;
  };

  run = async () => {
    this.step += 1;
    await this.load();
    this.status = `loaded ${this.step}`;
    await renderSettled();
    this.args.onDone?.(this.step, this.status);
  };

  start = () => {
    void this.run();
    this.status = "started";
  };

  @tracked selected = "none";

  @tracked hits = 0;

  @tracked log: string[] = [];

  @tracked status = "idle";

  @tracked step = 0;

  listener1 = () => this.pick("alpha");

  listener2 = () => this.pick("beta");

  <template><section
      class="picker"
      aria-label="Picker"
      style={{fallthroughStyle @style}}
      ...attributes
    ><div
      class="choices"
      role="presentation"
      {{on "click" this.report}}
    ><button type="button" {{on "click" this.listener1}}>Alpha</button><button
      type="button"
      {{on "click" this.listener2}}
    >Beta</button></div><ol
      aria-label="Log"
    >{{#each this.log key="@index" as |entry|}}<li>{{entry}}</li>{{/each}}</ol><p
      role="status"
    >{{this.status}}</p><button type="button" {{on "click" this.start}}>Start</button></section></template>
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
