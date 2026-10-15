import { type JSX, createContext, untrack } from "solid-js";

export interface LocaleProviderSlots {
  children?: JSX.Element;
}

export const LocaleKey = createContext<string>();

export default function LocaleProvider(
  props: { locale: string } & LocaleProviderSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <LocaleKey.Provider value={untrack(() => props.locale)}>
      <div lang={props.locale} class={props.class} style={props.style}>
        {props.children}
      </div>
    </LocaleKey.Provider>
  );
}
