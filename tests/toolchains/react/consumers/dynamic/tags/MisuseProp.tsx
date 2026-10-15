import Section from "../../../../../integration/cases/dynamic/tags/__output__/react/Section";

export function MisuseProp() {
  // @uf-expect TS2322 Section.prop:title
  return <Section title={[]} />;
}
