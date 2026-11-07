// The page host's boot, ahead of `@unframework/testing/setup` in the stub's document and in
// Storybook's runner document: it installs the host, whose modules the setup reaches the runner
// through, and the listeners for what nothing catches in the page.
import { installHost } from "../../browser/host.ts";
import { installErrorListeners } from "./errors.ts";
import { pageHost } from "./host.ts";

installHost(pageHost);
installErrorListeners();
