import { createRoot } from "react-dom/client";

import Greeting from "./Greeting.uf.tsx";
import { Hello } from "./Hello.tsx";
import { Showcase } from "./Showcase.tsx";

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(
    <>
      <Hello />
      <Greeting name="React" />
      <Showcase />
    </>,
  );
}
