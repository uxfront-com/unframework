import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import type { JSX } from "solid-js";

export default function Page(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style} {...scopeAttributes(props)}>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
