import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { capabilities, setModifierManager } from "@ember/modifier";
import type { ModifierLike } from "@glint/template";

export interface QuantitySignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Quantity extends Component<QuantitySignature> {
  @tracked count = 2;

  @tracked volume = 5;

  listener1 = (next: typeof this.count) => {
    this.count = next;
  };

  readonly initial1 = this.count;

  listener2 = (next: typeof this.volume) => {
    this.volume = next;
  };

  readonly initial2 = this.volume;

  get value1() {
    return this.count + 1;
  }

  get value2() {
    return this.volume + 1;
  }

  listener3 = () => (this.count = 10);

  <template><section
      aria-label="Order"
      style={{fallthroughStyle @style}}
      ...attributes
    ><input
      type="number"
      aria-label="Count"
      min="0"
      value={{this.initial1}}
      {{modelText this.count this.listener1 number=true}}
    ><input
      type="range"
      aria-label="Volume"
      min="0"
      max="10"
      value={{this.initial2}}
      {{modelText this.volume this.listener2 number=true}}
    ><output>Next: {{this.value1}}, volume {{this.value2}}</output><button
      type="button"
      {{on "click" this.listener3}}
    >Ten</button></section></template>
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

/**
 * A modifier that binds a text field as Vue's `vModelText` does: it writes what the user types,
 * trimmed or cast as `looseToNumber` casts it, on `input` or, when lazy, on `change`, and
 * shows each new value of the state, except where the text already reads as it, or while the
 * user types in a trimmed field what it reads as trimmed.
 */
const modelText = setModifierManager(
  () => ({
    capabilities: capabilities("3.22"),
    createModifier: (): ModelTextState => ({ setValue: () => {} }),
    installModifier(state: ModelTextState, element: Element, { positional, named }: ModelTextArgs) {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      state.field = field;
      state.setValue = positional[1];
      const read = () => {
        const text = named.trim ? field.value.trim() : field.value;
        return named.number ? looseToNumber(text) : text;
      };
      field.addEventListener(named.lazy ? "change" : "input", () => state.setValue(read()));
      if (named.trim || named.number) {
        field.addEventListener("change", () => {
          field.value = String(read());
        });
      }
      show(field, positional[0], named);
    },
    updateModifier(state: ModelTextState, { positional, named }: ModelTextArgs) {
      state.setValue = positional[1];
      if (state.field) show(state.field, positional[0], named);
    },
    destroyModifier() {},
  }),
  {},
) as unknown as ModifierLike<{
  Element: HTMLInputElement | HTMLTextAreaElement;
  Args: {
    Positional: [value: unknown, setValue: (value: never) => void];
    Named: { trim?: boolean; lazy?: boolean; number?: boolean };
  };
}>;

/** What `modelText` keeps of its field. */
interface ModelTextState {
  field?: HTMLInputElement | HTMLTextAreaElement;
  setValue: (value: unknown) => void;
}

/** What `modelText`'s manager is given. */
interface ModelTextArgs {
  positional: readonly [unknown, (value: unknown) => void];
  named: { trim?: boolean; lazy?: boolean; number?: boolean };
}

/** A text as a number where it reads as one, as Vue's `looseToNumber` casts it. */
function looseToNumber(text: string): string | number {
  const number = Number.parseFloat(text);
  return Number.isNaN(number) ? text : number;
}

/** Shows a state's value in a field, as `vModelText`'s update does. */
function show(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: unknown,
  named: { trim?: boolean; number?: boolean },
): void {
  const next = value ?? "";
  const shown =
    named.number && !/^0\d/.test(field.value) ? looseToNumber(field.value) : field.value;
  if (shown === next) return;
  const typing = document.activeElement === field && field.type !== "range";
  if (typing && named.trim && field.value.trim() === next) return;
  field.value = String(next);
}
