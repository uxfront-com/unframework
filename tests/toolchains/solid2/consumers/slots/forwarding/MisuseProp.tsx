import Frame from "../../../../../integration/cases/slots/forwarding/__output__/solid2/Frame";

export function MisuseProp() {
	// @uf-expect TS2322 Frame.prop:label
	return <Frame label={0} />;
}
