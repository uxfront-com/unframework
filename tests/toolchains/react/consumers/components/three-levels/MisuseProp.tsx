import Section from "../../../../../integration/cases/components/three-levels/__output__/react/Section";

export function MisuseProp() {
  // @uf-expect TS2322 Section.prop:body
  return <Section title="About" body={false} />;
}
