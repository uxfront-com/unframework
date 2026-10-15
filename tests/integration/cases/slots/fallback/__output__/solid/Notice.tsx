import { type JSX, children } from "solid-js";

export interface NoticeSlots {
  children?: JSX.Element;
  action?: JSX.Element;
}

export default function Notice(
  props: { label: string } & NoticeSlots & { class?: string; style?: JSX.CSSProperties },
) {
  const content = children(() => props.children);
  return (
    <div
      role="note"
      aria-label={props.label}
      class={props.class ? `notice ${props.class}` : "notice"}
      style={props.style}
    >
      <p>{content() ?? <em>Nothing to report.</em>}</p>
      {props.action ?? <span class="muted">No action</span>}
    </div>
  );
}
