// UF2014 impure-function-call: the template calls `greet`, which writes state: rendering must not
// change anything, and a framework renders when it decides to.
import { ref } from "unframework";

export interface GreetingProps {
  name: string;
}

export default function Greeting({ name }: GreetingProps) {
  const renders = ref(0);

  function greet() {
    renders.value += 1;
    return `Hello, ${name}`;
  }

  return <h2 class="greeting">{greet()}</h2>;
}
