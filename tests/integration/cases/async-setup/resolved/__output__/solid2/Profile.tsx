import { createState } from "./_unframework/createState";
import { loadUser } from "./api";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Loading, Show, createMemo, omit, untrack } from "solid-js";

export default function Profile(
  props: { id: string } & Omit<ComponentProps<"p">, "id" | "class" | "style"> & {
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
          const [visits, setVisits] = createState(user.visits);

          return (
            <p class={props.class ? `profile ${props.class}` : "profile"} {...others}>
              {user.name}{" "}
              <button type="button" onClick={() => setVisits(visits() + 1)}>
                Visits: {visits()}
              </button>
            </p>
          );
        }}
      </Show>
    </Loading>
  );
}
