import { Teleport } from "./_unframework/Teleport";
import { type ComponentProps, type JSX, createSignal, splitProps } from "solid-js";

export interface NoticeProps {
  message: string;
}

export default function Notice(
  props: NoticeProps &
    Omit<ComponentProps<"section">, "message" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["message", "class"]);

  const [dismissed, setDismissed] = createSignal(0);

  return (
    <section class={props.class ? `inbox ${props.class}` : "inbox"} aria-label="Inbox" {...others}>
      <p>Dismissed {dismissed()} times</p>
      <Teleport to="body">
        <div data-teleported="true" class="notice">
          <p role="status">
            {props.message} ({dismissed()})
          </p>
          <button type="button" onClick={() => setDismissed(dismissed() + 1)}>
            Dismiss
          </button>
        </div>
      </Teleport>
    </section>
  );
}
