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
  ({ locale, class: className, style }) => {
    useContextProvider(LocaleKey, locale);

    return (
      <div lang={locale} class={className} style={style}>
        <Slot />
      </div>
    );
  },
);
