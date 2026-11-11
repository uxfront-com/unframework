import { render } from "solid-js/web";

import { Hello } from "./Hello.tsx";
import { Showcase } from "./Showcase.tsx";

const root = document.getElementById("app");
if (root) {
  render(
    () => (
      <>
        <Hello />
        <Showcase />
      </>
    ),
    root,
  );
}
