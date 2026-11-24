import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import type { ComponentPropsWithRef } from "react";

export type PageAttributes = Omit<ComponentPropsWithRef<"main">, "children">;

export default function Page({ className, style, ...attributes }: PageAttributes) {
  return (
    <main className={className} style={style} {...attributes}>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}
