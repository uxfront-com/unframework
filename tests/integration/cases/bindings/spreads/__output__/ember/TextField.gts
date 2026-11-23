import type { TOC } from "@ember/component/template-only";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

interface FieldAttributes {
  name: string;
  placeholder?: string;
  autocomplete?: "email" | "username";
  maxlength?: number;
  required?: boolean;
  title?: string;
}

interface HintAttributes {
  id: string;
  title?: string;
}

export interface TextFieldProps {
  label: string;
  inputId: string;
  hintText: string;
  field: FieldAttributes;
  hint?: HintAttributes;
}

export interface TextFieldSignature {
  Args: TextFieldProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

const TextField: TOC<TextFieldSignature> = <template><div
    class="text-field"
    style={{fallthroughStyle @style}}
    ...attributes
  ><label for={{@inputId}}>{{@label}}</label><input
    id={{@inputId}}
    type="text"
    name={{@field.name}}
    placeholder={{@field.placeholder}}
    autocomplete={{@field.autocomplete}}
    maxlength={{@field.maxlength}}
    required={{@field.required}}
    title={{@field.title}}
  ><p class="text-field-hint" id={{@hint.id}} title={{@hint.title}}>{{@hintText}}</p></div></template>;

export default TextField;

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
