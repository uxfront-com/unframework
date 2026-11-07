import { mount } from "@unframework/target-svelte/toolchain/client";
import { createPreview } from "@unframework/visual/preview";

export const { parameters, renderToCanvas } = createPreview(mount);
