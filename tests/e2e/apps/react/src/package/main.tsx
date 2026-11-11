import { createRoot } from "react-dom/client";

import { Hello } from "./Hello.tsx";
import { Showcase } from "./Showcase.tsx";

const root = document.getElementById("app");
if (root) {
  createRoot(root).render(
    <>
      <Hello />
      <Showcase />
    </>,
  );
}
