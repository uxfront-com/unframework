import Button from "../../../../../integration/cases/types/extends-chain/__output__/react/Button";

export function MisuseProp() {
  // @uf-expect TS2322 Button.prop:label
  return <Button id="save" label={1} />;
}
