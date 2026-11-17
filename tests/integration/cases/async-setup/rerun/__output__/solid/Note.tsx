import { loadUser } from "./api";
import { type JSX, Show, Suspense, createResource, onCleanup, onMount } from "solid-js";

export interface NoteEvents {
  onReady?: (name: string) => void;
}

export default function Note(
  props: { id: string } & NoteEvents & { class?: string; style?: JSX.CSSProperties },
) {
  const [awaited] = createResource(async () => {
    const user = await loadUser(props.id);
    return { user };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user } = resolved();
          let input: HTMLInputElement | null = null;

          onMount(() => {
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
                  ref={(element) => {
                    input = element;
                    onCleanup(() => {
                      input = null;
                    });
                  }}
                  type="text"
                />
              </label>
            </form>
          );
        }}
      </Show>
    </Suspense>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
