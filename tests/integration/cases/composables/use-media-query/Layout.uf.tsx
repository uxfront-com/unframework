import { useMediaQuery } from "./useMediaQuery.uf.ts";

export default function Layout() {
  const { matches: wide } = useMediaQuery("(min-width: 1px)");
  const { matches: tiny } = useMediaQuery("(max-width: 1px)");

  return (
    <section class="layout" aria-label="Layout">
      <p role="status">{wide.value ? "Wide layout" : "Narrow layout"}</p>
      <p>{tiny.value ? "Tiny screen" : "Not a tiny screen"}</p>
    </section>
  );
}
