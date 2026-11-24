import { component$ } from "@qwik.dev/core";

import Palette from "../../../../../integration/cases/types/shared-type/__output__/qwik/Palette";
import type { Tone } from "../../../../../integration/cases/types/shared-type/__output__/qwik/Palette";

export const Consumer = component$(() => {
  const tone: Tone = "accent";
  return <Palette tone={tone} />;
});
