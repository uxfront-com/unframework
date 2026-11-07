import { mount } from "@unframework/target-angular/toolchain/client";
import { createPreview } from "@unframework/visual/preview";

export const { parameters, renderToCanvas } = createPreview(mount);
