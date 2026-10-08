// What the Vue output does on the server (ADR-0048): compiled as @vitejs/plugin-vue
// compiles it, inlined into `setup` and not, and rendered by Vue's server renderer, failing on
// any warning. Setup runs, and so does an immediate watcher's first callback (Vue runs it during
// the server's setup, so the analyser keeps it server-safe, UF2013); `watchPostEffect`, a
// watcher that is not immediate and the lifecycle hooks never run there, so no effect changes
// what the server renders and no timer outlives the request.
import { afterAll, describe, expect, it } from "vitest";

import { emitBehaviour } from "./behaviour-modules.ts";
import { emitSource, removeScratch, renderSfc } from "./helpers.ts";

afterAll(removeScratch);

describe.each([{ inline: true }, { inline: false }])(
  "vue setup on the server (inline: $inline)",
  (mode) => {
    /** Renders a component with listeners for its events, and what they heard. */
    async function render(contents: string, names: readonly string[], props = {}) {
      const heard: unknown[][] = [];
      const listeners = Object.fromEntries(
        names.map((name) => [
          `on${name[0]!.toUpperCase()}${name.slice(1)}`,
          (...args: unknown[]) => void heard.push([name, ...args]),
        ]),
      );
      const html = await renderSfc(contents, { ...props, ...listeners }, mode);
      return { html, heard };
    }

    it("runs an immediate watcher's first callback, and no other watcher or effect", async () => {
      const { html, heard } = await render(await emitBehaviour("Watchers"), [
        "counted",
        "cleanup",
        "pair",
        "parity",
        "items",
        "effect",
      ]);
      expect(heard).toEqual([["parity", true]]);
      expect(html).toContain("<ul><!--[--><!--]--></ul>");
    });

    it("runs no lifecycle hook, so no timer starts", async () => {
      const { html, heard } = await render(
        await emitBehaviour("Lifecycle"),
        ["mounted", "ticked", "unmounted"],
        { interval: 1 },
      );
      expect(html).toBe("<div>Ticking</div>");
      // A timer started on the server would tick here.
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(heard).toEqual([]);
    });

    it("renders the state that setup gives, whatever the effects and hooks would write", async () => {
      const source = `
import { onMounted, ref, watch, watchEffect } from "unframework";

export default function Status() {
  const online = ref<boolean>();
  const label = ref("Checking");
  const runs = ref(0);

  watch(online, (value) => {
    label.value = value ? "Online" : "Offline";
  });

  watchEffect(() => {
    runs.value = label.value.length;
  });

  onMounted(() => {
    online.value = true;
  });

  return (
    <p role="status" data-runs={runs.value}>
      {label.value}
    </p>
  );
}`;
      const { html } = await render(await emitSource(source), []);
      expect(html).toBe('<p role="status" data-runs="0">Checking</p>');
    });
  },
);
