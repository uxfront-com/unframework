import { component$ } from "@qwik.dev/core";

import Palette, {
  type Tone,
} from "../../../../../integration/cases/types/shared-type/__output__/qwik/Palette";

export const MisuseType = component$(() => {
  // @uf-expect TS2322 Palette.type:Tone
  const tone: Tone = "loud";
  return <Palette tone={tone} />;
});
