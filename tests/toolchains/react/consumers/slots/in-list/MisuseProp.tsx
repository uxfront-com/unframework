import Steps from "../../../../../integration/cases/slots/in-list/__output__/react/Steps";

export function MisuseProp() {
  // @uf-expect TS2322 Steps.prop:steps
  return <Steps steps="Boil" />;
}
