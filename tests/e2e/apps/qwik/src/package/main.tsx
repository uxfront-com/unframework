// Client-rendered elements keep their handlers for qwikloader's document-level delegation to
// call: without it, a click does nothing and nothing is logged.
// oxlint-disable-next-line import/no-unassigned-import -- the loader is a script run for its side effect
import "@qwik.dev/core/qwikloader.js";
import { render } from "@qwik.dev/core";

import { Hello } from "./Hello.tsx";
import { Showcase } from "./Showcase.tsx";

const root = document.getElementById("app");
if (root) {
  void render(
    root,
    <>
      <Hello />
      <Showcase />
    </>,
  );
}
