export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

// Text, a bound attribute, a class and a branch, each from the props the server rendered with.
export default function Plan({ name, price, href, featured = false, note }: PlanProps) {
  return (
    <article class={featured ? "plan featured" : "plan"} aria-label={name}>
      <h2>{name}</h2>
      <p>{price} EUR a month</p>
      {note ? <p class="note">{note}</p> : <p class="note">No commitment.</p>}
      <a href={href}>Choose {name}</a>
    </article>
  );
}
