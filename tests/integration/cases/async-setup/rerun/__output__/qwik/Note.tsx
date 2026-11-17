import { loadUser } from "./api";
import {
  type CSSProperties,
  type ClassList,
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
  { id: string } & NoteEvents & { class?: ClassList; style?: CSSProperties }
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
    <form
      class={["note", className]}
      aria-label="Note"
      {...scopeAttributes(attributes)}
      style={style}
    >
      <label>
        Note for {user.name} <input ref={input} type="text" />
      </label>
    </form>
  );
});

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
