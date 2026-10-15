import Field from "../../../../../integration/cases/fallthrough/inherit-attrs-false/__output__/react/Field";

export function MisuseProp() {
  // @uf-expect TS2322 Field.prop:label
  return <Field label={1} />;
}
