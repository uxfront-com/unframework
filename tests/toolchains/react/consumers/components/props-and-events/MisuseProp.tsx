import Field from "../../../../../integration/cases/components/props-and-events/__output__/react/Field";

export function MisuseProp() {
  // @uf-expect TS2322 Field.prop:label
  return <Field label={42} />;
}
