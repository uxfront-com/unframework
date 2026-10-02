import { component$ } from "@qwik.dev/core";

export interface GreetingProps {
  name?: string;
}

export default component$<GreetingProps>(({ name = "world" }) => {
  return <p class="greeting">Hello, {name}!</p>;
});
