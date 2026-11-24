import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import type { ComponentProps, JSX } from "@solidjs/web";

export default function Page(
  props: Omit<ComponentProps<"main">, "class" | "style"> & {
    class?: string;
    style?: JSX.CSSProperties;
  },
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
