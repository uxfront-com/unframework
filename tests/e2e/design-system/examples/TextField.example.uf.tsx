import { ref } from "@uxfront/unframework";

import TextField from "../src/TextField.uf.tsx";

export default function TextFieldExample() {
  const name = ref("Ada");
  return <TextField label="Name" v-model:value={name.value} />;
}
