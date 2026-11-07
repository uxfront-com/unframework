import { mount } from "@unframework/target-react/toolchain/client";
import { createPreview } from "@unframework/visual/preview";

export const { parameters, renderToCanvas } = createPreview(mount);
