import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface ShippingLabelProps {
  recipient: string;
  street: string;
  city: string;
  postcode: string;
}

export interface ShippingLabelSignature {
  Args: ShippingLabelProps & { style?: unknown };
  Element: HTMLElementTagNameMap["article"];
}

export default class ShippingLabel extends Component<ShippingLabelSignature> {
  get value1() {
    return this.args.city + "  " + this.args.postcode;
  }

  <template><article
      class="shipping-label"
      aria-label="Shipping label"
      style={{fallthroughStyle @style}}
      ...attributes
    ><p><strong>To:</strong> {{@recipient}}</p><p><span class="shipping-label-city">{{@city}}</span> <span
      class="shipping-label-postcode"
    >{{@postcode}}</span> <span class="shipping-label-country">United Kingdom</span></p><p>  Handle with care </p><pre>{{@recipient}}&#10;{{@street}}&#10;{{this.value1}}</pre><pre>Parcel:	1 of 2
Weight:	2.5 kg</pre><p>Sent by <em>Unframework Ltd</em>, on two
lines.</p></article></template>
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
