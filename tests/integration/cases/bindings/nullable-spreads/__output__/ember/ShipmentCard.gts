import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

interface LabelAttributes {
  id: string;
  title?: string;
}

interface Parcel {
  label: string;
  tag?: LabelAttributes;
  seal?: LabelAttributes;
}

export interface ShipmentCardProps {
  reference: string;
  carrier: LabelAttributes | null;
  eta?: LabelAttributes | null;
  parcel: Parcel;
  tracked: boolean;
  tracking: LabelAttributes;
  stops: (LabelAttributes | undefined)[];
  signature?: LabelAttributes;
}

export interface ShipmentCardSignature {
  Args: ShipmentCardProps & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class ShipmentCard extends Component<ShipmentCardSignature> {
  get eta() {
    return this.args.eta === undefined ? null : this.args.eta;
  }

  get value1() {
    return (this.args.tracked ? this.args.tracking : undefined)?.id;
  }

  get value2() {
    return (this.args.tracked ? this.args.tracking : undefined)?.title;
  }

  value3 = (index: number) => index + 1;

  get value4() {
    return !this.args.parcel.seal;
  }

  get value5() {
    return !!this.args.parcel.seal ? this.args.parcel.seal.id : undefined;
  }

  get value6() {
    return !!this.args.parcel.seal ? this.args.parcel.seal.title : undefined;
  }

  <template><section
      class="shipment-card"
      aria-label={{@reference}}
      style={{fallthroughStyle @style}}
      ...attributes
    ><p id={{@carrier.id}} title={{@carrier.title}}>Carrier</p><p
      id={{this.eta.id}}
      title={{this.eta.title}}
    >Estimated delivery</p><p
      id={{@parcel.tag.id}}
      title={{@parcel.tag.title}}
    >{{@parcel.label}}</p><p id={{this.value1}} title={{this.value2}}>Live tracking</p><ol>{{#each @stops key="@index" as |stop index|}}<li
      id={{stop.id}}
      title={{stop.title}}
    >Stop {{this.value3 index}}</li>{{/each}}</ol>{{#if @signature}}<p
      id={{@signature.id}}
      title={{@signature.title}}
    >Signed on delivery</p>{{/if}}{{#if this.value4}}<p>Not sealed</p>{{else}}<p
      id={{this.value5}}
      title={{this.value6}}
    >Sealed</p>{{/if}}</section></template>
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
