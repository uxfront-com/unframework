import { LocaleKey } from "./LocaleProvider";
import { type ComponentProps, type JSX, splitProps, useContext } from "solid-js";

export default function Greeting(
  props: { name: string } & Omit<ComponentProps<"p">, "name" | "style"> & {
      style?: JSX.CSSProperties;
    },
) {
  const [, others] = splitProps(props, ["name"]);

  const locale = useContext(LocaleKey) ?? "en";

  return (
    <p {...others}>
      {locale === "pt" ? "Olá" : "Hello"}, {props.name} ({locale})
    </p>
  );
}
