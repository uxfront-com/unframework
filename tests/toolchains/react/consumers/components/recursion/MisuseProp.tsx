import Countdown from "../../../../../integration/cases/components/recursion/__output__/react/Countdown";

export function MisuseProp() {
  // @uf-expect TS2322 Countdown.prop:from
  return <Countdown from="two" />;
}
