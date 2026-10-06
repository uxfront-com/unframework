import { mergeProps } from "solid-js";

export interface NoticeProps {
  message: string;
  title?: string;
  tone?: "info" | "warning";
  priority?: number;
  expanded?: boolean;
  tags?: string[];
  author?: { name: string };
}

export default function Notice(rawProps: NoticeProps) {
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
  return (
    <section class="notice" aria-label={props.title} data-tone={props.tone}>
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
