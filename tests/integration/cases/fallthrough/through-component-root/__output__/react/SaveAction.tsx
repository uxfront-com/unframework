import Pressable from "./Pressable";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";

export type SaveActionAttributes = Omit<
  ComponentPropsWithRef<typeof Pressable>,
  "text" | "children"
>;

export default function SaveAction({
  text,
  className,
  style,
  ...attributes
}: { text: string } & SaveActionAttributes) {
  return <Pressable text={text} className={cx("save", className)} style={style} {...attributes} />;
}
