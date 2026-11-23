import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface BillingSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["fieldset"];
}

export default class Billing extends Component<BillingSignature> {
  @tracked plan = "monthly";

  get value1() {
    return this.plan === "monthly";
  }

  listener1 = () => {
    this.plan = "monthly";
  };

  get value2() {
    return this.plan === "yearly";
  }

  listener2 = () => {
    this.plan = "yearly";
  };

  listener3 = () => (this.plan = "monthly");

  <template><fieldset
      style={{fallthroughStyle @style}}
      ...attributes
    ><legend>Billing</legend><label><input
      type="radio"
      name="plan"
      value="monthly"
      checked={{this.value1}}
      {{on "change" this.listener1}}
    > Monthly</label><label><input
      type="radio"
      name="plan"
      value="yearly"
      checked={{this.value2}}
      {{on "change" this.listener2}}
    > Yearly</label><output>Plan: {{this.plan}}</output><button
      type="button"
      {{on "click" this.listener3}}
    >Reset</button></fieldset></template>
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
