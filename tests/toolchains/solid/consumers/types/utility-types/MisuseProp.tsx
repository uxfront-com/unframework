import TextField from "../../../../../integration/cases/types/utility-types/__output__/solid/TextField";

export function MisuseProp() {
  // @uf-expect TS2322 TextField.prop:placeholder
  return <TextField name="email" label="Email" placeholder={1} />;
}
