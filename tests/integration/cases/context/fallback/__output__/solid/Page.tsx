import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import type { ComponentProps, JSX } from "solid-js";

export default function Page(
  props: Omit<ComponentProps<"main">, "style"> & { style?: JSX.CSSProperties },
) {
  return (
    <main {...props}>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}
