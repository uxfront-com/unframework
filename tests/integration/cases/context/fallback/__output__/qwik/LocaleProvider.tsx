import {
  type CSSProperties,
  type ClassList,
  type PropsOf,
  Slot,
  component$,
  createContextId,
  useContextProvider,
} from "@qwik.dev/core";

export const LocaleKey = createContextId<string>("uf.locale");

export default component$<
  { locale: string } & Omit<PropsOf<"div">, "locale" | "class" | "style"> & {
      class?: ClassList;
      style?: CSSProperties;
    }
>(({ locale, class: className, style, ...attributes }) => {
  useContextProvider(LocaleKey, locale);

  return (
    <div lang={locale} class={className} style={style} {...attributes}>
      <Slot />
    </div>
  );
});
