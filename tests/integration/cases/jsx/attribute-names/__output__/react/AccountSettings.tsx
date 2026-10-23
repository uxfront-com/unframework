import type { CSSProperties } from "react";

export interface AccountSettingsProps {
  charset: string;
  bioId: string;
  bioLimit: number;
  locked: boolean;
  bannerCors: "anonymous" | "use-credentials";
  seatColumns: number;
  helpOrder: number;
}

export interface AccountSettingsAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function AccountSettings({
  charset,
  bioId,
  bioLimit,
  locked,
  bannerCors,
  seatColumns,
  helpOrder,
  className,
  style,
  ...attributes
}: AccountSettingsProps & AccountSettingsAttributes) {
  return (
    <div
      className={cx("account-settings", className)}
      style={style}
      {...scopeAttributes(attributes)}
    >
      <form acceptCharset="utf-8" aria-label="Profile">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23345'/%3E%3C/svg%3E"
          alt="Avatar"
          width={40}
          height={40}
          crossOrigin="anonymous"
        />
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          type="text"
          name="display-name"
          maxLength={40}
          readOnly
          placeholder="Ada"
        />
        <label htmlFor={bioId}>Bio</label>
        <textarea id={bioId} name="bio" rows={3} maxLength={bioLimit} readOnly={locked} />
        <button type="button" tabIndex={0}>
          Profile help
        </button>
      </form>
      <form acceptCharset={charset} aria-label="Plan">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Crect width='120' height='40' fill='%23563'/%3E%3C/svg%3E"
          alt="Team plan banner"
          width={120}
          height={40}
          crossOrigin={bannerCors}
        />
        <table>
          <tbody>
            <tr>
              <th scope="row">Plan</th>
              <td colSpan={2}>Team</td>
            </tr>
            <tr>
              <th scope="row">Seats</th>
              <td colSpan={seatColumns}>12</td>
            </tr>
          </tbody>
        </table>
        <button type="button" tabIndex={helpOrder}>
          Plan help
        </button>
      </form>
    </div>
  );
}

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
