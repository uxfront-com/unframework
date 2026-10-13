import Counter from "../../../../../integration/cases/expose/several/__output__/react/Counter";

export function MisuseProp() {
  // @uf-expect TS2322 Counter.prop:start
  return <Counter start="one" />;
}
