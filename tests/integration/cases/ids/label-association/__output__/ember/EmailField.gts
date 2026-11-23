import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { getOwner } from "@ember/owner";

export interface EmailFieldProps {
  label: string;
  hint: string;
}

export interface EmailFieldSignature {
  Args: EmailFieldProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class EmailField extends Component<EmailFieldSignature> {
  readonly inputId = useId(this);

  readonly hintId = useId(this);

  <template><div
      class="email-field"
      style={{fallthroughStyle @style}}
      ...attributes
    ><label for={{this.inputId}}>{{@label}}</label><input
      id={{this.inputId}}
      name="email"
      type="email"
      aria-describedby={{this.hintId}}
    ><p id={{this.hintId}}>{{@hint}}</p></div></template>
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

/** How many ids each application gave, by its owner. */
const ids = new WeakMap<object, number>();

/**
 * Vue's `useId`: an id unique within the component's application. The server and the client
 * that hydrates its render create the components in the same order, so each gets the same id on
 * both, which a random id would not.
 */
function useId(component: object): string {
  const owner = getOwner(component) ?? component;
  const count = ids.get(owner) ?? 0;
  ids.set(owner, count + 1);
  return `uf-id-${count}`;
}
