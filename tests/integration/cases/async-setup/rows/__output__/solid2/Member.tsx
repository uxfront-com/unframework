import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, untrack } from "solid-js";

export default function Member(
  props: { id: string } & Omit<ComponentProps<"li">, "id" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "id", "class");

  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.id));
    return { user };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user } = resolved;

          return (
            <li class={props.class ? `member ${props.class}` : "member"} {...others}>
              {user.name}
            </li>
          );
        }}
      </Show>
    </Loading>
  );
}
