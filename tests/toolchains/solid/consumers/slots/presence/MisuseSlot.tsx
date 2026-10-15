import Card from "../../../../../integration/cases/slots/presence/__output__/solid/Card";

export function MisuseSlot() {
  return (
    <Card
      label="Weather"
      // @uf-expect TS2322 Card.slot:title
      title={(props: { size: number }) => props.size}
    />
  );
}
