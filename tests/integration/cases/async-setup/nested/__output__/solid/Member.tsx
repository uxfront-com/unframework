import { loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createResource,
  createSignal,
  splitProps,
  untrack,
} from "solid-js";

export default function Member(
  props: { id: string } & Omit<ComponentProps<"article">, "id" | "ref" | "style"> & {
      style?: JSX.CSSProperties;
      ref?: (api: { reset: () => void }) => void;
    },
) {
  const [, others] = splitProps(props, ["id", "ref", "class"]);

  const [awaited] = createResource(async () => {
    const user = await loadUser(props.id);
    return { user };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user } = resolved();
          const [visits, setVisits] = createSignal(user.visits);

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
    </Suspense>
  );
}
