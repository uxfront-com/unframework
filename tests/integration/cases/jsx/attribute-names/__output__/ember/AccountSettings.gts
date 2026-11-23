import type { TOC } from "@ember/component/template-only";
import { htmlSafe, isHTMLSafe, type SafeString } from "@ember/template";

export interface AccountSettingsProps {
  charset: string;
  bioId: string;
  bioLimit: number;
  locked: boolean;
  bannerCors: "anonymous" | "use-credentials";
  seatColumns: number;
  helpOrder: number;
}

export interface AccountSettingsSignature {
  Args: AccountSettingsProps & { style?: unknown };
  Element: HTMLElementTagNameMap["div"];
}

const AccountSettings: TOC<AccountSettingsSignature> = <template><div
    class="account-settings"
    style={{fallthroughStyle @style}}
    ...attributes
  ><form
    accept-charset="utf-8"
    aria-label="Profile"
  ><img
    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23345'/%3E%3C/svg%3E"
    alt="Avatar"
    width="40"
    height="40"
    crossorigin="anonymous"
  ><label for="display-name">Display name</label><input
    id="display-name"
    type="text"
    name="display-name"
    maxlength="40"
    readonly
    placeholder="Ada"
  ><label for={{@bioId}}>Bio</label><textarea
    id={{@bioId}}
    name="bio"
    rows="3"
    maxlength={{@bioLimit}}
    readonly={{@locked}}
  ></textarea><button type="button" tabindex="0">Profile help</button></form><form
    accept-charset={{@charset}}
    aria-label="Plan"
  ><img
    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Crect width='120' height='40' fill='%23563'/%3E%3C/svg%3E"
    alt="Team plan banner"
    width="120"
    height="40"
    crossorigin={{@bannerCors}}
  ><table><tbody><tr><th scope="row">Plan</th><td colspan="2">Team</td></tr><tr><th
    scope="row"
  >Seats</th><td colspan={{@seatColumns}}>12</td></tr></tbody></table><button
    type="button"
    tabindex={{@helpOrder}}
  >Plan help</button></form></div></template>;

export default AccountSettings;

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
