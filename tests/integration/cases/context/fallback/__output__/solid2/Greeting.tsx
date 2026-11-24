import { LocaleKey } from "./LocaleProvider";
import type { ComponentProps, JSX } from "@solidjs/web";
import { omit, useContext } from "solid-js";

export default function Greeting(
  props: { name: string } & Omit<ComponentProps<"p">, "name" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "name");

  const locale = useContext(LocaleKey) ?? "en";

  return (
    <p {...others}>
      {locale === "pt" ? "Olá" : "Hello"}, {props.name} ({locale})
    </p>
  );
}
