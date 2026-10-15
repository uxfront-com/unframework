import LocaleProvider from "../../../../../integration/cases/context/fallback/__output__/react/LocaleProvider";

export function MisuseSlot() {
  // @uf-expect TS2322 LocaleProvider.slot:default
  return <LocaleProvider locale="pt">{() => "Olá"}</LocaleProvider>;
}
