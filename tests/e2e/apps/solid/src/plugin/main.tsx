import { render } from "solid-js/web";

import Greeting from "./Greeting.uf.tsx";
import { Hello } from "./Hello.tsx";
import { Showcase } from "./Showcase.tsx";

const root = document.getElementById("app");
if (root) {
  render(
    () => (
      <>
        <Hello />
        <Greeting name="Solid" />
        <Showcase />
      </>
    ),
    root,
  );
}
