import Button from "../../../../../integration/cases/types/exported-types/__output__/solid/Button";

export function MisuseProp() {
  // @uf-expect TS2322 Button.prop:tone
  return <Button label="Save" tone="danger" />;
}
