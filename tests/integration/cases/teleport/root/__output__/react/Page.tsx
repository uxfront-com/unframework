import Toast from "./Toast";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Page.uf.tsx.css";

export interface PageProps {
  message: string;
}

export type PageAttributes = Omit<ComponentPropsWithRef<"section">, "message" | "children">;

export default function Page({
  message,
  className,
  style,
  ...attributes
}: PageProps & PageAttributes) {
  return (
    <section
      className={cx("page", className)}
      aria-label="Page"
      style={style}
      data-uf-5a3bed67=""
      {...attributes}
    >
      <p data-uf-5a3bed67="">Saving…</p>
      <Toast message={message} data-uf-5a3bed67="" />
    </section>
  );
}
