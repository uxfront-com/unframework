import { loadTeam, loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createMemo,
  createResource,
  splitProps,
} from "solid-js";

export default function Membership(
  props: { id: string } & Omit<ComponentProps<"p">, "id" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["id", "class"]);

  const [awaited] = createResource(async () => {
    const user = await loadUser(props.id);
    const team = await loadTeam(user.teamId);
    return { user, team };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user, team } = resolved();
          const summary = createMemo(() => `${user.name} is in ${team.name}`);

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
    </Suspense>
  );
}
