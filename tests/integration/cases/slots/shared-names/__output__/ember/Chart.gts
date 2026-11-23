import Component from "@glimmer/component";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Legend, { type LegendSignature } from "./Legend.gts";

export interface ChartSignature {
  Args: { series: string[] } & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

export default class Chart extends Component<ChartSignature> {
  value1 = (swatchProps: LegendSignature["Blocks"]["swatch"][0]) => swatchProps.item.slice(0, 1);

  value2 = (captionProps: LegendSignature["Blocks"]["caption"][0]) =>
    captionProps.item.toUpperCase();

  <template><div
      style={{fallthroughStyle @style}}
      ...attributes
    ><Legend
      @items={{@series}}
      @label="Series"
    ><:swatch as |swatchProps|><b>{{this.value1 swatchProps}}</b></:swatch><:caption as |captionProps|><i>{{captionProps.item}}</i></:caption></Legend><Legend
      @items={{@series}}
      @label="Captions"
    ><:caption as |captionProps|><span>{{this.value2 captionProps}}</span></:caption></Legend></div></template>
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
