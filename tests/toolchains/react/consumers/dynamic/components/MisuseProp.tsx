import Chip from "../../../../../integration/cases/dynamic/components/__output__/react/Chip";

export function MisuseProp() {
  // @uf-expect TS2322 Chip.prop:label
  return <Chip label={0} />;
}
