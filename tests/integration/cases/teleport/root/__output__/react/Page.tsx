import Toast from "./Toast";
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

/** Joins class names, and the keys of an object's truthy entries, into one `className`. */
function cx(...parts: unknown[]): string {
  const names: string[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) names.push(part);
    } else if (part && typeof part === "object") {
      for (const [key, on] of Object.entries(part)) {
        if (on) names.push(key);
      }
    }
  }
  return names.join(" ");
}
