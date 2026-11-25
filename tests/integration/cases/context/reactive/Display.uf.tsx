import { inject, ref } from "@uxfront/unframework";

import { CountKey } from "./Counter.uf.tsx";

export default function Display() {
  const none = ref(0);
  const count = inject(CountKey, none);
  return <output>Count: {count.value}</output>;
}
