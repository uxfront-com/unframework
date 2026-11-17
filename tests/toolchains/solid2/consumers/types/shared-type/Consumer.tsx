import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/solid2/Palette";

const tone: Tone = "accent";

export function Consumer() {
  return <Palette tone={tone} />;
}
