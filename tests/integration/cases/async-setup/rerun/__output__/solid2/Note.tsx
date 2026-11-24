import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, onCleanup, onSettled, untrack } from "solid-js";

export interface NoteEvents {
  onReady?: (name: string) => void;
}

export default function Note(
  props: { id: string } & NoteEvents &
    Omit<ComponentProps<"form">, "id" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "id", "onReady", "class");

  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.id));
    return { user };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user } = resolved;
          let input: HTMLInputElement | null = null;

          onSettled(() => {
            input?.focus();
            props.onReady?.(user.name);
          });

          return (
            <form
              class={props.class ? `note ${props.class}` : "note"}
              aria-label="Note"
              {...others}
            >
              <label>
                Note for {user.name}{" "}
                <input
                  ref={clearedRef(
                    (element) => {
                      input = element;
                    },
                    () => {
                      input = null;
                    },
                  )}
                  type="text"
                />
              </label>
            </form>
          );
        }}
      </Show>
    </Loading>
  );
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}
