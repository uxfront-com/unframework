import { greeting } from "virtual:uf-fixture";

import "./Greeting.css";

export default function Greeting() {
  return <p class={greeting("warm")}>Hello</p>;
}
