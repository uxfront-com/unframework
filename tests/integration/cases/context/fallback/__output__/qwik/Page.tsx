import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style }) => {
    return (
      <main class={className} style={style}>
        <Greeting name="Ada" />
        <LocaleProvider locale="pt">
          <Greeting name="Inês" />
        </LocaleProvider>
      </main>
    );
  },
);
