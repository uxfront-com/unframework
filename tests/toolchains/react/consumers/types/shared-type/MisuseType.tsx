import Palette from "../../../../../integration/cases/types/shared-type/__output__/react/Palette";
import type { Tone } from "../../../../../integration/cases/types/shared-type/__output__/react/Palette";

export function MisuseType() {
	// @uf-expect TS2322 Palette.type:Tone
	const tone: Tone = "loud";
	return <Palette tone={tone} />;
}
