import { loadUser } from "./api";
import type { JSX } from "@solidjs/web";
import { Loading, Show, createMemo, onCleanup, onSettled, untrack } from "solid-js";

export interface NoteEvents {
  onReady?: (name: string) => void;
}

export default function Note(
  props: { id: string } & NoteEvents & { class?: string; style?: JSX.CSSProperties },
) {
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
              style={props.style}
              {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}

/** A `ref` that calls `callback` with its element, and `clear` once the element is removed. */
function clearedRef<T>(callback: (element: T) => void, clear: () => void): (element: T) => void {
  onCleanup(clear);
  return callback;
}
