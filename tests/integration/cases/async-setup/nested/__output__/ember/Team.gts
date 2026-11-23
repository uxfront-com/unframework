import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import Lead from "./Lead.gts";
import Member from "./Member.gts";

export interface TeamSignature {
  Args: { ids: string[] } & { style?: unknown };
  Element: HTMLElementTagNameMap["section"];
}

export default class Team extends Component<TeamSignature> {
  @tracked first: { reset(): void } | null = null;

  listener1 = () => this.first?.reset();

  <template><section
      class="team"
      aria-label="Team"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>Team</h2><button type="button" {{on "click" this.listener1}}>Reset</button><Member
      @ref={{componentRef this "first"}}
      @id="ada"
    /><ul>{{#each @ids key="@identity" as |id|}}<li><Member @id={{id}} /></li>{{/each}}</ul><Lead
      @id="hopper"
      class="lead"
    /></section></template>
}

/** Sets a member of its component to what a child exposes, or to `null` once the child is gone. */
function componentRef(owner: object, name: string): (exposed: unknown) => void {
  return (exposed) => void Reflect.set(owner, name, exposed);
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
