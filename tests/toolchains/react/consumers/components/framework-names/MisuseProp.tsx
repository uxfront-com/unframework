import Step from "../../../../../integration/cases/components/framework-names/__output__/react/Transition";

export function MisuseProp() {
  // @uf-expect TS2322 Transition.prop:step
  return <Step step={2} />;
}
