import { cx } from "./_unframework/cx";
import type { ComponentProps, JSX } from "@solidjs/web";
import { Show, merge, omit } from "solid-js";

export interface PlanProps {
  name: string;
  price: number;
  href: string;
  featured?: boolean;
  note?: string;
}

export default function Plan(
  rawProps: PlanProps &
    Omit<
      ComponentProps<"article">,
      "name" | "price" | "href" | "featured" | "note" | "class" | "style"
    > & { class?: string; style?: JSX.CSSProperties },
) {
  const props = merge(rawProps, {
    get featured() {
      return rawProps.featured === undefined ? false : rawProps.featured;
    },
  });
  const others = omit(props, "name", "price", "href", "featured", "note", "class");

  return (
    <article
      class={cx(props.featured ? "plan featured" : "plan", props.class)}
      aria-label={props.name}
      {...others}
    >
      <h2>{props.name}</h2>
      <p>{props.price} EUR a month</p>
      <Show when={props.note} fallback={<p class="note">No commitment.</p>}>
        {(note) => <p class="note">{note()}</p>}
      </Show>
      <a href={props.href}>Choose {props.name}</a>
    </article>
  );
}
