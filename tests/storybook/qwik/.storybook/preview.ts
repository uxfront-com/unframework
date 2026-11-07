import { mount } from "@unframework/target-qwik/toolchain/client";
import { createPreview } from "@unframework/visual/preview";

export const { parameters, renderToCanvas } = createPreview(mount);
