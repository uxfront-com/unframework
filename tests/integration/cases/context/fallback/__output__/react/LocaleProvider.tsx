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
}: { locale: string } & LocaleProviderSlots & LocaleProviderAttributes) {
  const [localeValue] = useState(locale);

  return (
    <LocaleKey value={localeValue}>
      <div lang={locale} className={className} style={style}>
        {children}
      </div>
    </LocaleKey>
  );
}
