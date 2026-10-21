import { type CSSProperties, type ClassList, component$ } from "@qwik.dev/core";

export default component$<
  { gap: string; accent: string } & { class?: ClassList; style?: CSSProperties }
>(({ gap, accent, class: className, style }) => {
  return (
    <ul
      class={["stack", className]}
      style={{ "--gap": gap, "--accent": accent, ...style }}
      data-uf-e3a22111=""
    >
      <li class="item" data-uf-e3a22111="">
        One
      </li>
      <li class="item" data-uf-e3a22111="">
        Two
      </li>
      <li class="item" data-uf-e3a22111="">
        Three
      </li>
    </ul>
  );
});
