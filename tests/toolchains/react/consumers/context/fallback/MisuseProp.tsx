import Greeting from "../../../../../integration/cases/context/fallback/__output__/react/Greeting";

export function MisuseProp() {
  // @uf-expect TS2322 Greeting.prop:name
  return <Greeting name={7} />;
}
