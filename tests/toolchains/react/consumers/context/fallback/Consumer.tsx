import Greeting from "../../../../../integration/cases/context/fallback/__output__/react/Greeting";
import LocaleProvider from "../../../../../integration/cases/context/fallback/__output__/react/LocaleProvider";

export function Consumer() {
  return (
    <LocaleProvider locale="pt">
      <Greeting name="Inês" />
    </LocaleProvider>
  );
}
