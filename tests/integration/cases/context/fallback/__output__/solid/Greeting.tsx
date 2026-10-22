import { LocaleKey } from "./LocaleProvider";
import { type JSX, useContext } from "solid-js";

export default function Greeting(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const locale = useContext(LocaleKey) ?? "en";

  return (
    <p class={props.class} style={props.style} {...scopeAttributes(props)}>
      {locale === "pt" ? "Olá" : "Hello"}, {props.name} ({locale})
    </p>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
