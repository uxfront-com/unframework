import Names from "../../../../../integration/cases/slots/scoped-default/__output__/react/Names";

export function Consumer() {
  return <Names names={["Ada"]} renderDefault={({ item }) => item.toUpperCase()} />;
}
