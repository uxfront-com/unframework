import Badge, { ToneKey } from "./Badge";
import { loadUser } from "./api";
import { type JSX, Show, Suspense, createResource } from "solid-js";

export interface PanelSlots {
  children?: JSX.Element;
}

export default function Panel(
  props: { id: string } & PanelSlots & { class?: string; style?: JSX.CSSProperties },
) {
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
                style={props.style}
                {...scopeAttributes(props)}
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

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
