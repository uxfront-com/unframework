import Heading from "../../../../../integration/cases/dynamic/prop-union/__output__/react/Heading";

export function MisuseProp() {
  // @uf-expect TS2322 Heading.prop:tag
  return <Heading tag="h4" text="Setup" />;
}
