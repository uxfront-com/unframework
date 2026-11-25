import Palette from "../../../../../integration/cases/types/shared-type/__output__/solid/Palette";
import type { Tone } from "../../../../../integration/cases/types/shared-type/__output__/solid/Palette";

// @uf-expect TS2322 Palette.type:Tone
const tone: Tone = "loud";

export function MisuseType() {
	return <Palette tone={tone} />;
}
