import { LocaleKey } from "./LocaleProvider";
import { type JSX, useContext } from "solid-js";

export default function Greeting(
  props: { name: string } & { class?: string; style?: JSX.CSSProperties },
) {
  const locale = useContext(LocaleKey) ?? "en";

  return (
    <p class={props.class} style={props.style}>
      {locale === "pt" ? "Olá" : "Hello"}, {props.name} ({locale})
    </p>
  );
}
