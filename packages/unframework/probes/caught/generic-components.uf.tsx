// What stock tsgo catches on a generic component (ADR-0068): `T` is inferred from the props, so they
// are checked against it and against its constraint.
import Select from "../fixtures/Select.uf.tsx";
import type { Option } from "../fixtures/types.ts";

interface User extends Option {
  email: string;
}

function Pair<T>({ first, second }: { first: T; second: T }) {
  return (
    <p>
      {String(first)} and {String(second)}
    </p>
  );
}

export function ConstraintViolated() {
  // @ts-expect-error TS2322 `T extends Option`: a number is no Option
  return <Select options={[1]} />;
}

export function InferredFromOneProp() {
  // @ts-expect-error TS2322 `T` is number from `first`, so `second` must be a number
  return <Pair first={1} second="two" />;
}

export function ExplicitTypeArgument(users: Option[]) {
  // @ts-expect-error TS2322 an explicit `T` checks the props: an Option has no `email`
  return <Select<User> options={users} />;
}

export function WrongPropBesideT() {
  // @ts-expect-error TS2322 `label` is a string
  return <Select options={[{ id: "a", label: "A" }]} label={3} />;
}
