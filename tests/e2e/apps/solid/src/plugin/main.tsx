import { render } from "solid-js/web";

import { Hello } from "./Hello.tsx";

const root = document.getElementById("app");
if (root) render(() => <Hello />, root);
