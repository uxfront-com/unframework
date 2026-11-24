import { loadTeam, loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, untrack } from "solid-js";

export default function Membership(
  props: { id: string } & Omit<ComponentProps<"p">, "id" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "id", "class");

  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.id));
    const team = await loadTeam(user.teamId);
    return { user, team };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user, team } = resolved;
          const summary = () => `${user.name} is in ${team.name}`;

          return (
            <p
              class={props.class ? `membership ${props.class}` : "membership"}
              role="status"
              {...others}
            >
              {summary()}
            </p>
          );
        }}
      </Show>
    </Loading>
  );
}
