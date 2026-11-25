import Note from "./Note";
import { cx } from "./_unframework/cx";
import type { ComponentPropsWithRef } from "react";
import "./Article.uf.tsx.css";

export type ArticleAttributes = Omit<
  ComponentPropsWithRef<"article">,
  "title" | "note" | "children"
>;

export default function Article({
  title,
  note,
  className,
  style,
  ...attributes
}: { title: string; note: string } & ArticleAttributes) {
  return (
    <article className={cx("article", className)} style={style} data-uf-15946226="" {...attributes}>
      <h2 className="title" data-uf-15946226="">
        {title}
      </h2>
      <Note text={note} data-uf-15946226="" />
    </article>
  );
}
