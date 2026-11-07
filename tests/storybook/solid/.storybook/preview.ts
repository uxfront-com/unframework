import { mount } from "@unframework/target-solid/toolchain/client";
import { createPreview } from "@unframework/visual/preview";

export const { parameters, renderToCanvas } = createPreview(mount);
