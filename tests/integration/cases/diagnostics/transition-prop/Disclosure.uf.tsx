// UF3058 transition-prop: `name` is a string literal that is not empty, and `appear` a literal,
// so a bound `name`, an empty `name` and a bound `appear` are rejected.
import { Transition, ref } from "@uxfront/unframework";

export default function Disclosure() {
  const open = ref(false);
  const effect = ref("fade");

  return (
    <section>
      <Transition name={effect.value}>
        <p>Bound</p>
      </Transition>
      <Transition name="">
        <p>Empty</p>
      </Transition>
      <Transition appear={open.value}>
        <p>Appear</p>
      </Transition>
    </section>
  );
}
