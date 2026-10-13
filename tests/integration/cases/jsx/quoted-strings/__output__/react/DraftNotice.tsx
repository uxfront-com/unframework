import type { CSSProperties } from "react";

export interface DraftNoticeProps {
  author: string;
  saved: boolean;
}

export interface DraftNoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function DraftNotice({
  author,
  saved,
  className,
  style,
}: DraftNoticeProps & DraftNoticeAttributes) {
  return (
    <section className={cx("draft-notice", className)} aria-label="Draft" style={style}>
      <img
        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect width='32' height='32' fill='%23345'/%3E%3C/svg%3E"
        alt={`${author}'s avatar`}
        width={32}
        height={32}
      />
      <p title={saved ? "Saved" : "Don't forget to save"}>{saved ? "Saved" : 'Not "saved" yet'}</p>
      <p title={saved ? "Nothing to save" : `Press "Save" to keep ${author}'s changes`}>
        {saved ? `${author}'s draft is safe.` : `${author} says: "I'll save it later."`}
      </p>
    </section>
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
