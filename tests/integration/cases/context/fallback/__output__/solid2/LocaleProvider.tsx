import type { ComponentProps, JSX } from "@solidjs/web";
import { createContext, omit, untrack } from "solid-js";

export interface LocaleProviderSlots {
  children?: JSX.Element;
}

export const LocaleKey = createContext<string | null>(null);

export default function LocaleProvider(
  props: { locale: string } & LocaleProviderSlots &
    Omit<ComponentProps<"div">, "locale" | "children" | "class" | "style"> & {
      class?: string;
      style?: JSX.CSSProperties;
    },
) {
  const others = omit(props, "locale", "children");

  return (
    <LocaleKey value={untrack(() => props.locale)}>
      <div lang={props.locale} {...others}>
        {props.children}
      </div>
    </LocaleKey>
  );
}
