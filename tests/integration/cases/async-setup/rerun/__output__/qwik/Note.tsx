import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  type QRL,
  component$,
  untrack,
  useComputed$,
  useSignal,
  useVisibleTask$,
} from "@qwik.dev/core";

export interface NoteEvents {
  onReady$?: QRL<(name: string) => void>;
}

export default component$<
  { id: string } & NoteEvents &
    Omit<PropsOf<"form">, "id" | "onReady$" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ id, onReady$, class: className, style, ...attributes }) => {
  const userLoad = useComputed$(() => untrack(() => loadUser(id)));
  const user = userLoad.value;
  const input = useSignal<HTMLInputElement>();

  useVisibleTask$(
    () => {
      input.value?.focus();
      onReady$?.(user.name);
    },
    { strategy: "document-ready" },
  );

  return (
    <form class={["note", className]} aria-label="Note" style={style} {...attributes}>
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
    </form>
  );
});
