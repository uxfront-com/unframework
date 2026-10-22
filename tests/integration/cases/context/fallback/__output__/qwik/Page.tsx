import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<{ class?: ClassList; style?: CSSProperties }>(
  ({ class: className, style, ...attributes }) => {
    return (
      <main {...scopeAttributes(attributes)} class={className} style={style}>
        <Greeting name="Ada" />
        <LocaleProvider locale="pt">
          <Greeting name="Inês" />
        </LocaleProvider>
      </main>
    );
  },
);

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
