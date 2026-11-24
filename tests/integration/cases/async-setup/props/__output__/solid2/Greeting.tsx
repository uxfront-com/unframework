import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, untrack } from "solid-js";

export default function Greeting(
  props: { id: string; prefix: string } & Omit<
    ComponentProps<"section">,
    "id" | "prefix" | "class" | "style"
  > & { class?: string; style?: JSX.CSSProperties },
) {
  const others = omit(props, "id", "prefix", "class");

  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.prefix + props.id));
    return { user };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user } = resolved;

          return (
            <section
              class={props.class ? `greeting ${props.class}` : "greeting"}
              aria-label="Greeting"
              {...others}
            >
              <h2>Hello, {user.name}</h2>
              <p>Signed in as {props.id}</p>
            </section>
          );
        }}
      </Show>
    </Loading>
  );
}
