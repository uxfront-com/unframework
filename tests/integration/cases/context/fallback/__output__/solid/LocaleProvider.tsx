import { type ComponentProps, type JSX, createContext, splitProps, untrack } from "solid-js";

export interface LocaleProviderSlots {
  children?: JSX.Element;
}

export const LocaleKey = createContext<string>();

export default function LocaleProvider(
  props: { locale: string } & LocaleProviderSlots &
    Omit<ComponentProps<"div">, "locale" | "children" | "style"> & { style?: JSX.CSSProperties },
) {
  const [, others] = splitProps(props, ["locale", "children"]);

  return (
    <LocaleKey.Provider value={untrack(() => props.locale)}>
      <div lang={props.locale} {...others}>
        {props.children}
      </div>
    </LocaleKey.Provider>
  );
}
