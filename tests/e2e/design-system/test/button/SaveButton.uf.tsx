// A harness parent (ADR-0057): `mount` takes props but no slots, and a button needs its label.
import Button from "../../src/Button.uf.tsx";
import type { ButtonVariant } from "../../src/types";

export default function SaveButton({ variant }: { variant?: ButtonVariant }) {
  return <Button variant={variant}>Save</Button>;
}
