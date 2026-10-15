import type { CSSProperties } from "react";

export interface ProfileCardAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function ProfileCard({ className, style }: ProfileCardAttributes) {
  return (
    <article className={cx("profile", className)} aria-labelledby="profile-name" style={style}>
      <header className="profile-header">
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect width='48' height='48' fill='%23345'/%3E%3C/svg%3E"
          alt="Ada's avatar"
          width={48}
          height={48}
        />
        <h2 id="profile-name">Ada Lovelace</h2>
      </header>
      <p>
        Mathematician &amp; writer
        <br />
        of the first published program
      </p>
      <hr />
      <label htmlFor="profile-note">Note</label>
      <input id="profile-note" type="text" name="note" placeholder="Say hello" />
    </article>
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
