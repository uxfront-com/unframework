import { mount } from "svelte";

import Hello from "./Hello.svelte";

const target = document.getElementById("app");
if (target) mount(Hello, { target });
