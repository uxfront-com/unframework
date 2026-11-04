import { component$ } from "@qwik.dev/core";

import TextField from "../../../../../integration/cases/types/utility-types/__output__/qwik/TextField";

export const MisuseProp = component$(() => {
  // @uf-expect TS2322 TextField.prop:placeholder
  return <TextField name="email" label="Email" placeholder={1} />;
});
