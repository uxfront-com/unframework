import Field from "../../../../../integration/cases/fallthrough/rest/__output__/react/Field";

export function MisuseProp() {
  // @uf-expect TS2322 Field.prop:label
  return <Field lable="Email" />;
}
