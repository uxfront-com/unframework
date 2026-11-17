import { loadTeam, loadUser } from "./api";
import type { JSX } from "@solidjs/web";
import { Loading, Show, createMemo, untrack } from "solid-js";

export default function Membership(
  props: { id: string } & { class?: string; style?: JSX.CSSProperties },
) {
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
              style={props.style}
              {...scopeAttributes(props)}
            >
              {summary()}
            </p>
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
