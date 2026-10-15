import Names from "../../../../../integration/cases/slots/scoped-default/__output__/react/Names";

export function MisuseProp() {
  // @uf-expect TS2322 Names.prop:names
  return <Names names="Ada" />;
}
