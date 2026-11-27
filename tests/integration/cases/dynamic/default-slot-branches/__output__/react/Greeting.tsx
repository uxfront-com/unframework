import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef, ReactNode } from "react";

export interface User {
  name: string;
}

export interface GreetingSlots {
  children?: ReactNode;
}

export type GreetingAttributes = Omit<ComponentPropsWithRef<"p">, "user" | "children">;

export default function Greeting({
  user,
  children,
  className,
  style,
  ...attributes
}: { user?: User } & GreetingSlots & GreetingAttributes) {
  return (
    <p className={cx("greeting", className)} style={style} {...attributes}>
      {user ? <b>{children ?? user.name}</b> : <i>{children ?? "Guest"}</i>}
    </p>
  );
}
