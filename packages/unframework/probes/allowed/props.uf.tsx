// Legitimate props (ADR-0034): the forms M1 lowers. Nothing here may error.

type Tone = "info" | "warning";

interface Finish {
  sku: string;
  label: string;
}

export interface CardProps {
  title: string;
  tone?: Tone;
  count?: number;
  pill?: boolean;
  level?: 1 | 2 | 3;
  tags?: string[];
  finishes: readonly Finish[];
  size: { width: number; unit: "cm" | "in" };
  note?: string | null;
}

// Destructured, with static defaults; a member left out of the pattern is still a prop.
export default function Card({
  title,
  tone = "info",
  pill = false,
  level = 1,
  tags = ["general"],
  finishes,
  size,
  note = null,
}: CardProps) {
  return (
    <section class={["card", `card-${tone}`, pill && "card-pill"]} data-level={level}>
      <h2>{title}</h2>
      <p>
        {size.width} {size.unit}, {tags.join(", ")}
      </p>
      <ul>
        {finishes.map((finish) => (
          <li key={finish.sku}>{finish.label}</li>
        ))}
      </ul>
      <p>{note ?? "No note"}</p>
    </section>
  );
}

// The object form, read as `props.x`, when no prop needs a default.
export function Byline(props: { author: string; minutes?: number }) {
  return (
    <p>
      {props.author}, {props.minutes ?? 1} min
    </p>
  );
}

// An inline type, and an alias of an interface.
type CardAlias = CardProps;

export function Badge({ label }: { label: string }) {
  return <span>{label}</span>;
}

export function Summary({ title }: CardAlias) {
  return <h3>{title}</h3>;
}
