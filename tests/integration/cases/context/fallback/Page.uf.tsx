import Greeting from "./Greeting.uf.tsx";
import LocaleProvider from "./LocaleProvider.uf.tsx";

export default function Page() {
  return (
    <main>
      <Greeting name="Ada" />
      <LocaleProvider locale="pt">
        <Greeting name="Inês" />
      </LocaleProvider>
    </main>
  );
}
