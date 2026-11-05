import { createRoot } from "react-dom/client";

import { Hello } from "./Hello.tsx";

const root = document.getElementById("app");
if (root) createRoot(root).render(<Hello />);
