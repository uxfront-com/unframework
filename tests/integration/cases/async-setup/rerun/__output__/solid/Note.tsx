import { loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createResource,
  onCleanup,
  onMount,
  splitProps,
} from "solid-js";

export interface NoteEvents {
  onReady?: (name: string) => void;
}

export default function Note(
  props: { id: string } & NoteEvents &
    Omit<ComponentProps<"form">, "id" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["id", "onReady", "class"]);

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
              {...others}
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
