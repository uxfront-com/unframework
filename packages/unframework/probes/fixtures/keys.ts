import type { InjectionKey, Ref } from "unframework";

export interface Tabs {
  active: Ref<string>;
  select(id: string): void;
}

export const TabsKey: InjectionKey<Tabs> = Symbol("Tabs");
