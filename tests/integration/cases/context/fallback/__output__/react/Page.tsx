import Greeting from "./Greeting";
import LocaleProvider from "./LocaleProvider";
import { scopeAttributes } from "./_unframework/scopeAttributes";
import type { CSSProperties } from "react";

export interface PageAttributes {
  className?: string;
  style?: CSSProperties;
}

export default function Page({ className, style, ...attributes }: PageAttributes) {
  return (
    <main className={className} style={style} {...scopeAttributes(attributes)}>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}
