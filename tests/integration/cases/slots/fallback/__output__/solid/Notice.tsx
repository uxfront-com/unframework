import { type ComponentProps, type JSX, children, splitProps } from "solid-js";

export interface NoticeSlots {
  children?: JSX.Element;
  action?: JSX.Element;
}

export default function Notice(
  props: { label: string } & NoticeSlots &
    Omit<ComponentProps<"div">, "label" | "children" | "action" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["label", "children", "action", "class"]);

  const content = children(() => props.children);
  return (
    <div
      role="note"
      aria-label={props.label}
      class={props.class ? `notice ${props.class}` : "notice"}
      {...others}
    >
      <p>{content() ?? <em>Nothing to report.</em>}</p>
      {props.action ?? <span class="muted">No action</span>}
    </div>
  );
}
