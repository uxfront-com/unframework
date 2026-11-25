import Badge from "../../../../../integration/cases/types/imported-interface/__output__/solid2/Badge";

export function MisuseProp() {
	// @uf-expect TS2322 Badge.prop:tone
	return <Badge label="New" tone="warning" />;
}
