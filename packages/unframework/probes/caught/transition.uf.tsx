// What the types of `<Transition>` catch (ADR-0100): `name` is a string.
import { Transition } from "@uxfront/unframework";

export function NumberName() {
  return (
    // @ts-expect-error TS2322 `name` is the prefix of the transition's classes, a string
    <Transition name={1}>
      <div />
    </Transition>
  );
}
