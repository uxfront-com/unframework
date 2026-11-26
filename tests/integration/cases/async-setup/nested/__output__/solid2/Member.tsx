import { createState } from "./_unframework/createState";
import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, untrack } from "solid-js";

export default function Member(
  props: { id: string } & Omit<ComponentProps<"article">, "id" | "ref" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
      ref?: (api: { reset: () => void }) => void;
    },
) {
  const others = omit(props, "id", "ref", "class");

  const awaited = createMemo(async () => {
    const user = await untrack(() => loadUser(props.id));
    return { user };
  });

  return (
    <Loading>
      <Show when={awaited()} keyed>
        {(resolved) => {
          const { user } = resolved;
          const [visits, setVisits] = createState(user.visits);

          function reset() {
            setVisits(0);
          }

          untrack(() => props.ref?.({ reset }));

          return (
            <article class={props.class ? `member ${props.class}` : "member"} {...others}>
              <h3>{user.name}</h3>
              <button type="button" onClick={() => setVisits(visits() + 1)}>
                {user.name} visits: {visits()}
              </button>
            </article>
          );
        }}
      </Show>
    </Loading>
  );
}
