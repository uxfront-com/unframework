import PriceRange from "../../../../../integration/cases/models/several/__output__/solid2/PriceRange";

export function MisuseProp() {
  // @uf-expect TS2322 PriceRange.prop:label
  return <PriceRange label={false} />;
}
