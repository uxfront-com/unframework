import Card from "../../../../../integration/cases/components/local-sibling/__output__/react/Card";

export function MisuseProp() {
  // @uf-expect TS2322 Card.prop:title
  return <Card title={1} />;
}
