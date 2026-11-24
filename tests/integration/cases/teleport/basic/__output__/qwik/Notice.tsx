import { teleport } from "./_unframework/teleport";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface NoticeProps {
  message: string;
}

export default component$<
  NoticeProps &
    Omit<PropsOf<"section">, "message" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ message, class: className, style, ...attributes }) => {
  const dismissed = useSignal(0);

  const mounted = useSignal(false);
  useVisibleTask$(
    () => {
      mounted.value = true;
    },
    { strategy: "document-ready" },
  );

  return (
    <section class={["inbox", className]} aria-label="Inbox" style={style} {...attributes}>
      <p>Dismissed {dismissed.value} times</p>
      {mounted.value && (
        <>
          {""}
          <div ref={teleport("body")} data-teleported="true" class="notice">
            <p role="status">
              {message} ({dismissed.value})
            </p>
            <button type="button" onClick$={() => dismissed.value++}>
              Dismiss
            </button>
          </div>
        </>
      )}
    </section>
  );
});
