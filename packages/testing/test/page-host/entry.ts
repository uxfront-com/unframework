// The stub's document: the page host's boot, then the spec file the driver names. A spec imports
// the setup itself, as the stub parity specs do.
import "../../src/hosts/page/setup.ts";
import { runSpecFile } from "../../src/hosts/page/runner.ts";

const specs = import.meta.glob("../parity/cases/stub/page-*/*.spec.ts");
const query = new URLSearchParams(location.search);
const load = specs[`../parity/cases/stub/${query.get("spec")!}`];
if (!load) throw new Error(`No stub spec is named ${query.get("spec")}.`);
await runSpecFile({ filepath: query.get("file")!, load });
