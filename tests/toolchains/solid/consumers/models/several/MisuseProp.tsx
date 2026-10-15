import PriceRange from "../../../../../integration/cases/models/several/__output__/solid/PriceRange";

export function MisuseProp() {
  // @uf-expect TS2322 PriceRange.prop:label
  return <PriceRange label={false} />;
}
