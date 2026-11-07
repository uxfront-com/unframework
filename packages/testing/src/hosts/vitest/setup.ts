// The setup file every Vitest browser project loads first, ahead of `@unframework/testing/setup`,
// whose modules reach the runner through the host it installs.
import { installHost } from "../../browser/host.ts";
import { vitestHost } from "./host.ts";

installHost(vitestHost);
