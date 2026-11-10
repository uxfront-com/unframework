// A client-rendered element keeps its handlers for Qwik's loader, which delegates the page's
// events to them: without it a click does nothing, and nothing is logged.
// oxlint-disable-next-line import/no-unassigned-import -- the loader is a script run for its side effect
import "@qwik.dev/core/qwikloader.js";
import { render } from "@qwik.dev/core";

import Greeting from "./Greeting.uf.tsx";
import { Hello } from "./Hello.tsx";
import { Showcase } from "./Showcase.tsx";

const root = document.getElementById("app");
if (root) {
  void render(
    root,
    <>
      <Hello />
      <Greeting name="Qwik" />
      <Showcase />
    </>,
  );
}
