// What the types of `<Teleport>` catch (ADR-0098): `to` is a string.
import { Teleport } from "@uxfront/unframework";

export function NumberTarget() {
  return (
    // @ts-expect-error TS2322 `to` is a CSS selector, a string
    <Teleport to={1}>
      <div />
    </Teleport>
  );
}
