import { type ComponentPropsWithRef, type ReactNode, createContext, useState } from "react";

export interface LocaleProviderSlots {
  children?: ReactNode;
}

export type LocaleProviderAttributes = Omit<ComponentPropsWithRef<"div">, "locale" | "children">;

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
      <div lang={locale} className={className} style={style} {...attributes}>
        {children}
      </div>
    </LocaleKey>
  );
}
