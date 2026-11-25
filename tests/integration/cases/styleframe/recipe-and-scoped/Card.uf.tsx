import { button } from "virtual:styleframe";

import "virtual:styleframe.css";
import "./Card.css";

export default function Card({ title }: { title: string }) {
  return (
    <article class={["card", button({ size: "lg", tone: "primary" })]}>
      <h2 class="title">{title}</h2>
    </article>
  );
}
