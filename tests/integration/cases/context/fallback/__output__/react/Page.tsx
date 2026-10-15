import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style }: PageAttributes) {
  return (
    <main className={className} style={style}>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}
