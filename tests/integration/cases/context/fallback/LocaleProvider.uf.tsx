import { defineSlots, provide } from "@uxfront/unframework";
import type { Element, InjectionKey } from "@uxfront/unframework";

export const LocaleKey: InjectionKey<string> = Symbol("uf.locale");

export default function LocaleProvider({ locale }: { locale: string }) {
  const slots = defineSlots<{ default?(): Element }>();
  provide(LocaleKey, locale);
  return <div lang={locale}>{slots.default?.()}</div>;
}
