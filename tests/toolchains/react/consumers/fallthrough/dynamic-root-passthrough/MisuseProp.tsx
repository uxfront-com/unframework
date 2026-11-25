import Base from "../../../../../integration/cases/fallthrough/dynamic-root-passthrough/__output__/react/Base";

export function MisuseProp() {
	// @uf-expect TS2322 Base.prop:text
	return <Base txt="Docs" />;
}
