import Names from "../../../../../integration/cases/slots/scoped-default/__output__/solid2/Names";

export function Consumer() {
	return <Names names={["Ada"]}>{({ item }) => item.toUpperCase()}</Names>;
}
