import { type ComponentProps, type JSX, mergeProps, splitProps } from "solid-js";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

export default function Notice(
  rawProps: NoticeProps &
    Omit<
      ComponentProps<"section">,
      "message" | "title" | "tone" | "priority" | "expanded" | "tags" | "author" | "style"
    > & { style?: JSX.CSSProperties },
) {
  const defaults: Required<
    Pick<NoticeProps, "title" | "tone" | "priority" | "expanded" | "tags" | "author">
  > = {
    title: "Notice",
    tone: "info",
    priority: 1,
    expanded: false,
    tags: ["general"],
    author: { name: "System" },
  };
  const props = mergeProps(defaults, rawProps);
  const [, others] = splitProps(props, [
    "message",
    "title",
    "tone",
    "priority",
    "expanded",
    "tags",
    "author",
    "class",
  ]);

  return (
    <section
      class={props.class ? `notice ${props.class}` : "notice"}
      aria-label={props.title}
      data-tone={props.tone}
      {...others}
    >
      <h2>{props.title}</h2>
      <p>{props.message}</p>
      <details open={props.expanded}>
        <summary>Priority {props.priority}</summary>
        <p>
          Tagged {props.tags.join(", ")}, posted by {props.author.name}.
        </p>
      </details>
    </section>
  );
}
