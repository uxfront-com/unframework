import { inject } from "unframework";

import { LocaleKey } from "./LocaleProvider.uf.tsx";

export default function Greeting({ name }: { name: string }) {
  const locale = inject(LocaleKey, "en");
  return (
    <p>
      {locale === "pt" ? "Olá" : "Hello"}, {name} ({locale})
    </p>
  );
}
