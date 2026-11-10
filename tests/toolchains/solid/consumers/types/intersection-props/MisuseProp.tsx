import Chip from "../../../../../integration/cases/types/intersection-props/__output__/solid/Chip";

export function MisuseProp() {
  // @uf-expect TS2322 Chip.prop:size
  return <Chip size="medium" label="Draft" />;
}
