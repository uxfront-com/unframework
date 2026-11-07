// The stub's runner document, in place of a Storybook's, since this package sits below
// `@unframework/visual` (`LAYERS`): the page host's boot, and each stub spec as a lazy chunk. A spec
// imports the setup itself.
import "../../src/hosts/page/setup.ts";
import { runSpecFile } from "../../src/hosts/page/runner.ts";

const specs = import.meta.glob("./cases/stub/*/*.spec.ts");

(globalThis as Record<string, unknown>).__ufRunSpec = async (filepath: string) => {
  const load = specs[`.${filepath.slice(filepath.lastIndexOf("/cases/"))}`];
  if (!load) throw new Error(`This build holds no spec ${filepath}.`);
  return runSpecFile({ filepath, load });
};
