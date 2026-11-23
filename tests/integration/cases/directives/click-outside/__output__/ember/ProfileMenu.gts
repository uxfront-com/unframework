import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";
import { vClickOutside } from "./vClickOutside.ts";

export interface ProfileMenuEvents {
  onClosed?: () => void;
}

export interface ProfileMenuSignature {
  Args: { style?: unknown } & ProfileMenuEvents;
  Element: HTMLElementTagNameMap["section"];
}

export default class ProfileMenu extends Component<ProfileMenuSignature> {
  close = () => {
    if (!this.open) return;
    this.open = false;
    this.args.onClosed?.();
  };

  @tracked open = false;

  listener1 = () => (this.open = !this.open);

  <template><section
      class="profile-menu"
      aria-label="Profile"
      style={{fallthroughStyle @style}}
      ...attributes
    ><div
      class="menu"
      {{vClickOutside this.close}}
    ><button
      type="button"
      aria-expanded={{enumeratedValue this.open}}
      {{on "click" this.listener1}}
    >Account</button>{{#if this.open}}<ul
      aria-label="Account actions"
    ><li><button type="button">Settings</button></li><li><button type="button">Sign out</button></li></ul>{{/if}}</div><p>Outside the menu</p></section></template>
}

/** An enumerated attribute's value: a boolean as its name, any other value as it is. */
function enumeratedValue<T>(value: T): Exclude<T, boolean> | "true" | "false" {
  return typeof value === "boolean"
    ? (String(value) as "true" | "false")
    : (value as Exclude<T, boolean>);
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
