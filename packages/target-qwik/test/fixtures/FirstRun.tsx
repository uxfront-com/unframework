import { component$, sync$, useSignal } from "@qwik.dev/core";

import { appended } from "./appended.ts";

// The handlers of one action in segments of two shapes: a checkbox's click handler calls an
// imported function, so its segment has a static import, and its change handler's has none; a
// click handler that prevents the default in its body; and the controls Qwik runs at dispatch, a
// `sync$` handler and a `preventdefault:click` attribute (test/loads.browser.test.ts).
export default component$(() => {
  const log = useSignal<string[]>([]);
  return (
    <div>
      <label>
        <input
          type="checkbox"
          name="public"
          onClick$={() => (log.value = appended(log.value, "click"))}
          onChange$={() => (log.value = [...log.value, "change"])}
        />
        Public
      </label>
      <label>
        <input type="checkbox" name="locked" onClick$={(event) => event.preventDefault()} />
        Locked
      </label>
      <label>
        <input
          type="checkbox"
          name="synced"
          onClick$={sync$((event: MouseEvent) => event.preventDefault())}
        />
        Synced
      </label>
      <label>
        <input
          type="checkbox"
          name="declared"
          preventdefault:click
          onClick$={() => (log.value = [...log.value, "declared"])}
        />
        Declared
      </label>
      <output>{log.value.join(", ")}</output>
    </div>
  );
});
