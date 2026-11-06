import { render } from "@qwik.dev/core";

import { Hello } from "./Hello.tsx";

const root = document.getElementById("app");
if (root) void render(root, <Hello />);
