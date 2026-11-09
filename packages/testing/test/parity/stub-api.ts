// What the stubs need of a test run that the corpus's specs don't, on the page host's hooks and
// bindings. Importing this registers a hook, so a stub imports it after the setup.
import { host } from "../../src/browser/host.ts";
import type { HostTest } from "../../src/browser/host.ts";
import { callNode } from "../../src/hosts/page/config.ts";
import { it } from "../../src/index.ts";
import type { SpecTest, View } from "../../src/index.ts";

const tasks = new Map<string, HostTest>();

host().hooks.beforeEach((test) => {
  tasks.set((test as HostTest & { name: string }).name, test);
});

/**
 * The task of the test with this name, once it has started. A test a capability skips never gets
 * here: its record is in the reporter's (`test/interactions.test.ts`).
 */
export function sibling(name: string): HostTest | undefined {
  return tasks.get(name);
}

/** The names of the tests that have started, in order. */
export function siblingNames(): string[] {
  return [...tasks.keys()];
}

/**
 * A test whose body update mode leaves out: it would write the artefacts the test expects to be
 * missing, or overwrite those written by hand. The test stays, passing, since a spec file with no
 * test fails.
 */
export const itUnlessUpdate: SpecTest = host().inject("ufHarness").update
  ? (name: string) => {
      it(name, () => {
        host().expect(true).toEqual(true);
      });
    }
  : it;

/** The container's pixels, as a PNG in base64: the stub project's own binding. */
export async function screenshot(view: View): Promise<string> {
  return (await callNode("ufStubScreenshot", [view.locator.serialize()])) as string;
}
