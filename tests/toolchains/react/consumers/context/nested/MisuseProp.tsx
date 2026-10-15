import Level from "../../../../../integration/cases/context/nested/__output__/react/Level";

export function MisuseProp() {
  // @uf-expect TS2322 Level.prop:title
  return <Level title={null} />;
}
