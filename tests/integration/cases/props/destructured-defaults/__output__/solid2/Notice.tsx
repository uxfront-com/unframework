import type { ComponentProps, JSX } from "@solidjs/web";
import { merge, omit } from "solid-js";

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
      "message" | "title" | "tone" | "priority" | "expanded" | "tags" | "author" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
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
  const props = merge(rawProps, {
    get title() {
      return rawProps.title === undefined ? defaults.title : rawProps.title;
    },
    get tone() {
      return rawProps.tone === undefined ? defaults.tone : rawProps.tone;
    },
    get priority() {
      return rawProps.priority === undefined ? defaults.priority : rawProps.priority;
    },
    get expanded() {
      return rawProps.expanded === undefined ? defaults.expanded : rawProps.expanded;
    },
    get tags() {
      return rawProps.tags === undefined ? defaults.tags : rawProps.tags;
    },
    get author() {
      return rawProps.author === undefined ? defaults.author : rawProps.author;
    },
  });
  const others = omit(
    props,
    "message",
    "title",
    "tone",
    "priority",
    "expanded",
    "tags",
    "author",
    "class",
  );

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
