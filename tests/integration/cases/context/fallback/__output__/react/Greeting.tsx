import { LocaleKey } from "./LocaleProvider";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import { type CSSProperties, use } from "react";

export interface GreetingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Greeting({
  name,
  className,
  style,
  ...attributes
}: { name: string } & GreetingAttributes) {
  const locale = use(LocaleKey) ?? "en";

  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
    </p>
  );
}
