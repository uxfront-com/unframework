import { LocaleKey } from "./LocaleProvider";
import { type CSSProperties, use } from "react";

export interface GreetingAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Greeting({
  name,
  className,
  style,
}: { name: string } & GreetingAttributes) {
  const locale = use(LocaleKey) ?? "en";

  return (
    <p className={className} style={style}>
      {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
    </p>
  );
}
