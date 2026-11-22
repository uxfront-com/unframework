import { cx } from "./_unframework/cx";
import { scopeAttributes } from "./_unframework/scopeAttributes";
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
  ...attributes
}: NoticeProps & NoticeAttributes) {
  return (
    <section
      className={cx("notice", className)}
      aria-label={title}
      data-tone={tone}
      style={style}
      {...scopeAttributes(attributes)}
    >
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
