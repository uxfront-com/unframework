import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

export default component$<NoticeProps & { class?: ClassList; style?: CSSProperties }>(
  ({
    message,
    title = "Notice",
    tone = "info",
    priority = 1,
    expanded = false,
    tags = ["general"],
    author = { name: "System" },
    class: className,
    style,
    ...attributes
  }) => {
    return (
      <section
        class={["notice", className]}
        aria-label={title}
        data-tone={tone}
        {...scopeAttributes(attributes)}
        style={style}
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
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
