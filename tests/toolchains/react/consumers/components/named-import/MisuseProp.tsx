import { Pill } from "../../../../../integration/cases/components/named-import/__output__/react/Pill";

export function MisuseProp() {
  // @uf-expect TS2322 Pill.prop:text
  return <Pill text={0} />;
}
