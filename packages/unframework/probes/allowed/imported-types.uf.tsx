// Consumers of components whose props types live in another module (ADR-0067), and a consumer that
// imports those types itself: no false errors under stock tsgo.
import Badge from "../fixtures/Badge.uf.tsx";
import Chip from "../fixtures/Chip.uf.tsx";
import Counter, { type CounterProps } from "../fixtures/Counter.uf.tsx";
import type { BadgeProps, Tone } from "../fixtures/types.ts";

export function ImportedTypes({ tone, badge }: { tone: Tone; badge: BadgeProps }) {
  return (
    <section>
      {/* An `extends` chain and a literal union from a `.ts` module. */}
      <Badge label="New" tone={tone} count={3} />
      <Badge label={badge.label} tone={badge.tone} />
      {/* `Readonly<Omit<…>>` and an intersection, with an event and fallthrough. */}
      <Chip label="Tag" tone="info" removable onRemove={() => {}} class="chip" />
    </section>
  );
}

// A props type imported from a child `.uf.tsx` module, narrowed with `Pick` and `Partial`.
export function Stepper({ step, label }: Partial<Pick<CounterProps, "step">> & { label: string }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <Counter step={step} />
    </fieldset>
  );
}
