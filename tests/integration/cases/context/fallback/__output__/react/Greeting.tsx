import { LocaleKey } from "./LocaleProvider";
import { type ComponentPropsWithRef, use } from "react";

export type GreetingAttributes = Omit<ComponentPropsWithRef<"p">, "name" | "children">;

export default function Greeting({
  name,
  className,
  style,
  ...attributes
}: { name: string } & GreetingAttributes) {
  const locale = use(LocaleKey) ?? "en";

  return (
    <p className={className} style={style} {...attributes}>
      {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
    </p>
  );
}
