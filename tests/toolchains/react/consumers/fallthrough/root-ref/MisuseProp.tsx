import NameField from "../../../../../integration/cases/fallthrough/root-ref/__output__/react/NameField";

export function MisuseProp() {
  // @uf-expect TS2322 NameField.prop:label
  return <NameField lable="Name" />;
}
