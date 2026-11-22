import Card from "./Card";
import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export default component$<
  { author: string } & Omit<
    PropsOf<typeof Card>,
    "author" | "class" | "style" | "header$" | "footer$"
  > & { class?: ClassList; style?: CSSProperties }
>(({ author, class: className, style, ...attributes }) => {
  return (
    <>
      <Card
        header$={() => <h2>Release notes</h2>}
        footer$={() => <small>By {author}</small>}
        class={className}
        style={style}
        {...attributes}
      >
        <p>Slots arrive in M3.</p>
      </Card>
    </>
  );
});
