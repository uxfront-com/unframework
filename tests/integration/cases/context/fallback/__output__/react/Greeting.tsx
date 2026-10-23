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
  ...attributes
}: { name: string } & GreetingAttributes) {
  const locale = use(LocaleKey) ?? "en";

  return (
    <p className={className} style={style} {...scopeAttributes(attributes)}>
      {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
    </p>
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
