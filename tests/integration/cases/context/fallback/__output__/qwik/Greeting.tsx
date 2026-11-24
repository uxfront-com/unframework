import { LocaleKey } from "./LocaleProvider";
import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  component$,
  useContext,
} from "@qwik.dev/core";

export default component$<
  { name: string } & Omit<PropsOf<"p">, "name" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ name, class: className, style, ...attributes }) => {
  const locale = useContext(LocaleKey, (provided?) => (provided === undefined ? "en" : provided));

  return (
    <p class={className} style={style} {...attributes}>
      {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
    </p>
  );
});
