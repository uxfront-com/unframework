import Names from "../../../../../integration/cases/slots/scoped-default/__output__/solid/Names";

export function Consumer() {
  return <Names names={["Ada"]}>{({ item }) => item.toUpperCase()}</Names>;
}
