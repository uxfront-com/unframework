import Names from "../../../../../integration/cases/slots/scoped-default/__output__/solid2/Names";

export function MisuseProp() {
	// @uf-expect TS2322 Names.prop:names
	return <Names names="Ada" />;
}
