import { LocaleKey } from "./LocaleProvider";
import { type CSSProperties, type ClassList, component$, useContext } from "@qwik.dev/core";

export default component$<{ name: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ name, class: className, style }) => {
    const locale = useContext(LocaleKey, (provided?) => (provided === undefined ? "en" : provided));

    return (
      <p class={className} style={style}>
        {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
      </p>
    );
  },
);
