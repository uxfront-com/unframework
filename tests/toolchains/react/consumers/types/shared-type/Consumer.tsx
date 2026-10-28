import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/react/Palette";

export function Consumer() {
  const tone: Tone = "accent";
  return <Palette tone={tone} />;
}
