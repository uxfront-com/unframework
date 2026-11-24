import Heading from "./Heading";
import type { ComponentPropsWithRef } from "react";

export type OutlineAttributes = Omit<ComponentPropsWithRef<"main">, "children">;

export default function Outline({ className, style, ...attributes }: OutlineAttributes) {
  return (
    <main className={className} style={style} {...attributes}>
      <Heading tag="h1" text="Guide" />
      <Heading tag="h2" text="Setup" />
      <Heading tag="h3" text="Requirements" />
    </main>
  );
}
