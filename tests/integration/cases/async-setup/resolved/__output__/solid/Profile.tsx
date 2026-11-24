import { loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createResource,
  createSignal,
  splitProps,
} from "solid-js";

export default function Profile(
  props: { id: string } & Omit<ComponentProps<"p">, "id" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["id", "class"]);

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
    </Suspense>
  );
}
