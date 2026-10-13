import Stepper from "../../../../../integration/cases/models/component/__output__/react/Stepper";

export function MisuseProp() {
  // @uf-expect TS2322 Stepper.prop:label
  return <Stepper label={2} />;
}
