import type { JSX } from "@solidjs/web";
import { createContext, untrack } from "solid-js";

export interface LocaleProviderSlots {
  children?: JSX.Element;
}

export const LocaleKey = createContext<string | null>(null);

export default function LocaleProvider(
  props: { locale: string } & LocaleProviderSlots & { class?: string; style?: JSX.CSSProperties },
) {
  return (
    <LocaleKey value={untrack(() => props.locale)}>
      <div lang={props.locale} class={props.class} style={props.style} {...scopeAttributes(props)}>
        {props.children}
      </div>
    </LocaleKey>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const name of Object.keys(props)) if (name.startsWith("data-uf-")) scope[name] = "";
  return scope;
}
