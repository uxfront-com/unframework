import SaveButton from "../../../../../integration/cases/fallthrough/attributes/__output__/react/SaveButton";

export function MisuseProp() {
  // @uf-expect TS2322 SaveButton.prop:title
  return <SaveButton titel="Save" />;
}
