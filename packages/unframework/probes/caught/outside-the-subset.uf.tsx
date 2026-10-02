// Constructs plan §4.6 rejects that the types reject too (the compiler reports them as well). The
// rejected constructs the types cannot see are pinned in ../allowed/blind-spots.uf.tsx.
import {
  // @ts-expect-error TS2305 `reactive()` is outside the subset: `ref`, replaced whole (ADR-0008)
  reactive,
  // @ts-expect-error TS2305 `toRefs()` is outside the subset
  toRefs,
} from "unframework";

export function ReactiveState() {
  const state = reactive({ count: 0 });
  const { count } = toRefs(state);
  return <output>{count}</output>;
}

function RendersLater() {
  return () => <div />;
}

export function SetupReturnsARenderFunction() {
  // @ts-expect-error TS2786 a component returns its JSX; returning a render function is outside the subset
  return <RendersLater />;
}

export function OpenDynamicComponent({ tag }: { tag: string }) {
  // @ts-expect-error TS2322 `is` takes a statically known set of tags or components, not any string
  return <component is={tag} />;
}
