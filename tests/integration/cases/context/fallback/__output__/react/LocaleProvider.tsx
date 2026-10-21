import { type CSSProperties, type ReactNode, createContext, useState } from "react";

export interface LocaleProviderSlots {
  children?: ReactNode;
}

export interface LocaleProviderAttributes {
  className?: string;
  style?: CSSProperties;
}

export const LocaleKey = createContext<string | undefined>(undefined);

export default function LocaleProvider({
  locale,
  children,
  className,
  style,
  ...attributes
}: { locale: string } & LocaleProviderSlots & LocaleProviderAttributes) {
  const [localeValue] = useState(locale);

  return (
    <LocaleKey value={localeValue}>
      <div lang={locale} className={className} style={style} {...scopeAttributes(attributes)}>
        {children}
      </div>
    </LocaleKey>
  );
}

/** The scope attributes of the styled parents that render this component, for its root. */
function scopeAttributes(props: object): Record<string, ""> {
  const scope: Record<string, ""> = {};
  for (const key of Object.keys(props)) {
    if (key.startsWith("data-uf-")) scope[key] = "";
  }
  return scope;
}
