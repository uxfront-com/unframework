import type { TOC } from "@ember/component/template-only";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface ProfileCardSignature {
  Args: { style?: unknown };
  Element: HTMLElementTagNameMap["article"];
}

const ProfileCard: TOC<ProfileCardSignature> = <template><article
    class="profile"
    aria-labelledby="profile-name"
    style={{fallthroughStyle @style}}
    ...attributes
  ><header
    class="profile-header"
  ><img
    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E"
    alt="Ada's avatar"
    width="48"
    height="48"
  ><h2 id="profile-name">Ada Lovelace</h2></header><p>Mathematician &amp; writer<br>of the first published program</p><hr><label
    for="profile-note"
  >Note</label><input id="profile-note" type="text" name="note" placeholder="Say hello"></article></template>;

export default ProfileCard;

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
