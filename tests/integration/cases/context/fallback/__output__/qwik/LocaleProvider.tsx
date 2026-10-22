import {
  type CSSProperties,
  type ClassList,
  Slot,
  component$,
  createContextId,
  useContextProvider,
} from "@qwik.dev/core";

export const LocaleKey = createContextId<string>("uf.locale");

export default component$<{ locale: string } & { class?: ClassList; style?: CSSProperties }>(
  ({ locale, class: className, style, ...attributes }) => {
    useContextProvider(LocaleKey, locale);

    return (
      <div lang={locale} {...scopeAttributes(attributes)} class={className} style={style}>
        <Slot />
      </div>
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
