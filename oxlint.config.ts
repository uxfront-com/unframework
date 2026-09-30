import base from "@uxfront/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [base],
  options: {
    typeAware: true,
  },
});
