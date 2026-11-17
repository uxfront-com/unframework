import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/solid2/Palette";

// @uf-expect TS2322 Palette.type:Tone
const tone: Tone = "loud";

export function MisuseType() {
  return <Palette tone={tone} />;
}
