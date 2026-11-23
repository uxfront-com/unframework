import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface TallyEvents {
  onTotal?: (value: number) => void;
  onSteps?: (values: number[]) => void;
  onLogged?: (entries: string[]) => void;
}

export interface TallySignature {
  Args: { style?: unknown } & TallyEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class Tally extends Component<TallySignature> {
  addTwice = () => {
    this.count++;
    this.count++;
    this.args.onTotal?.(this.count);
  };

  addFive = () => {
    this.count += 5;
    this.args.onTotal?.(this.count);
  };

  countUp = () => {
    const seen: number[] = [];
    for (let step = 0; step < 3; step++) {
      this.count += 1;
      seen.push(this.count);
    }
    this.args.onSteps?.(seen);
  };

  addTen = () => {
    this.count += 10;
  };

  addTenAndReport = () => {
    this.addTen();
    this.args.onTotal?.(this.count);
  };

  logCapture = () => {
    this.trail = [...this.trail, "capture"];
  };

  logBubble = () => {
    this.trail = [...this.trail, "bubble"];
    this.args.onLogged?.(this.trail);
  };

  @tracked count = 0;

  @tracked trail: string[] = [];

  get value1() {
    return this.trail.join(" then ");
  }

  <template><section
      class="tally"
      aria-label="Tally"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p role="status">Count: {{this.count}}</p><button
      type="button"
      {{on "click" this.addTwice}}
    >Add two</button><button type="button" {{on "click" this.addFive}}>Add five</button><button
      type="button"
      {{on "click" this.countUp}}
    >Count up three</button><button
      type="button"
      {{on "click" this.addTenAndReport}}
    >Add ten</button><button
      type="button"
      {{on "click" this.logCapture capture=true}}
      {{on "click" this.logBubble}}
    >Log the phases</button><p>Phases: {{this.value1}}</p></section></template>
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
