// UF5004 unscopable-selector: the stylesheet selects `:root`, which matches no element of the
// component, outside `:global()`.
import "./Page.css";

export default function Page({ title }: { title: string }) {
  return (
    <main class="page">
      <h1>{title}</h1>
    </main>
  );
}
