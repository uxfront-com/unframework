import Badge, { ToneKey } from "./Badge";
import { loadUser } from "./api";
import {
  type ComponentProps,
  type JSX,
  Show,
  Suspense,
  createResource,
  splitProps,
} from "solid-js";

export interface PanelSlots {
  children?: JSX.Element;
}

export default function Panel(
  props: { id: string } & PanelSlots &
    Omit<ComponentProps<"section">, "id" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["id", "children", "class"]);

  const [awaited] = createResource(async () => {
    const user = await loadUser(props.id);
    return { user };
  });

  return (
    <Suspense>
      <Show when={awaited()}>
        {(resolved) => {
          const { user } = resolved();

          return (
            <ToneKey.Provider value={"calm"}>
              <section
                class={props.class ? `panel ${props.class}` : "panel"}
                aria-label={user.name}
                {...others}
              >
                <Badge />
                {props.children}
              </section>
            </ToneKey.Provider>
          );
        }}
      </Show>
    </Suspense>
  );
}
