import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

export default component$<
  NoticeProps &
    Omit<
      PropsOf<"section">,
      "message" | "title" | "tone" | "priority" | "expanded" | "tags" | "author" | "class" | "style"
    > & { class?: ClassList; style?: CSSProperties }
>(
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
        style={style}
        {...attributes}
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
