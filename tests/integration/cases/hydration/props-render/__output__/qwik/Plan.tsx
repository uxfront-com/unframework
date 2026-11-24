import { type CSSProperties, type ClassList, type PropsOf, component$ } from "@qwik.dev/core";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export default component$<
  PlanProps &
    Omit<
      PropsOf<"article">,
      "name" | "price" | "href" | "featured" | "note" | "class" | "style"
    > & { class?: ClassList; style?: CSSProperties }
>(({ name, price, href, featured = false, note, class: className, style, ...attributes }) => {
  return (
    <article
      class={[featured ? "plan featured" : "plan", className]}
      aria-label={name}
      style={style}
      {...attributes}
    >
      <h2>{name}</h2>
      <p>{price} EUR a month</p>
      <>{note ? <p class="note">{note}</p> : <p class="note">No commitment.</p>}</>
      <a href={href}>Choose {name}</a>
    </article>
  );
});
