import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface Profile {
  name: string;
  title: string;
  available: boolean;
}

export interface ProfileCardProps {
  initial: Profile;
}

export interface ProfileCardSignature {
  Args: ProfileCardProps & { style?: unknown };
  Element: HTMLElementTagNameMap["article"];
}

export default class ProfileCard extends Component<ProfileCardSignature> {
  rename = (name: string) => {
    this.profile = { ...this.profile, name };
  };

  toggleAvailability = () => {
    this.profile = { ...this.profile, available: !this.profile.available };
  };

  @tracked profile = this.args.initial;

  get value1() {
    return this.profile.available ? "Available" : "Away";
  }

  listener1 = () => this.rename("Ada King");

  <template><article
      class="profile-card"
      aria-label="Profile"
      style={{fallthroughStyle @style}}
      ...attributes
    ><h2>{{this.profile.name}}</h2><p>{{this.profile.title}}</p><p role="status">{{this.value1}}</p><button
      type="button"
      {{on "click" this.listener1}}
    >Use married name</button><button
      type="button"
      aria-pressed={{enumeratedValue this.profile.available}}
      {{on "click" this.toggleAvailability}}
    >Available</button></article></template>
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
