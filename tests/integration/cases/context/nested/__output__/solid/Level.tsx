import { type JSX, createContext, useContext } from "solid-js";

export interface LevelSlots {
  children?: JSX.Element;
}

export const DepthKey = createContext<number>();

export default function Level(
  props: { title: string } & LevelSlots & { class?: string; style?: JSX.CSSProperties },
) {
  const depth = useContext(DepthKey) ?? 0;

  return (
    <DepthKey.Provider value={depth + 1}>
      <section
        aria-label={props.title}
        class={props.class}
        style={props.style}
        {...scopeAttributes(props)}
      >
        <h2>
          {props.title} at depth {depth}
        </h2>
        {props.children}
      </section>
    </DepthKey.Provider>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
