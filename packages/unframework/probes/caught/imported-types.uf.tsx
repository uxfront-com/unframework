// What stock tsgo catches on components whose props types live in another module (ADR-0067).
import Badge from "../fixtures/Badge.uf.tsx";
import Chip from "../fixtures/Chip.uf.tsx";

export function LiteralUnionFromModule() {
  // @ts-expect-error TS2322 `Tone` is "neutral" | "info" | "danger"
  return <Badge label="x" tone="warning" />;
}

export function RequiredMemberOfBase() {
  // @ts-expect-error TS2322 `label` comes from the `extends` chain and is required
  return <Badge tone="info" />;
}

export function OmittedMember() {
  // @ts-expect-error TS2322 `Omit<BadgeProps, "count">` leaves no `count`
  return <Chip label="x" count={1} />;
}
