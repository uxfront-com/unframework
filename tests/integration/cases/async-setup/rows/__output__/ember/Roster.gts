import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Member from "./Member.gts";

export interface RosterSignature {
  Args: { ids: string[] } & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Roster extends Component<RosterSignature> {
  @tracked lead = true;

  @tracked guest = false;

  listener1 = () => (this.lead = !this.lead);

  listener2 = () => (this.guest = !this.guest);

  <template><section
      class="roster"
      aria-label="Roster"
      style={{fallthroughStyle @style}}
      ...attributes
    ><button type="button" {{on "click" this.listener1}}>Switch lead</button><button
      type="button"
      {{on "click" this.listener2}}
    >Toggle guest</button><ul>{{#each @ids key="@identity" as |id|}}<Member @id={{id}} />{{/each}}{{#if this.lead}}<Member
      @id="ada"
    />{{else}}<Member @id="linus" />{{/if}}{{#if this.guest}}<Member @id="hopper" />{{/if}}</ul></section></template>
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
