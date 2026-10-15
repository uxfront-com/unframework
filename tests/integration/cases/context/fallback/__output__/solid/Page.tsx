import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import type { JSX } from "solid-js";

export default function Page(props: { class?: string; style?: JSX.CSSProperties }) {
  return (
    <main class={props.class} style={props.style}>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}
