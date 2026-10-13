import type { CSSProperties } from "react";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

export interface NoticeAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Notice({
  message,
  title = "Notice",
  tone = "info",
  priority = 1,
  expanded = false,
  tags = ["general"],
  author = { name: "System" },
  className,
  style,
}: NoticeProps & NoticeAttributes) {
  return (
    <section className={cx("notice", className)} aria-label={title} data-tone={tone} style={style}>
      <h2>{title}</h2>
      <p>{message}</p>
      <details open={expanded}>
        <summary>Priority {priority}</summary>
        <p>
          Tagged {tags.join(", ")}, posted by {author.name}.
        </p>
      </details>
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
