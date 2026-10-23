import "./Panel.css";
import Heading from "./Heading.uf.tsx";
import Status from "./Status.uf.tsx";

export default function Panel() {
  return (
    <section class="panel">
      <Heading big={true} text="Release" />
      <Heading big={false} text="Notes" />
      <Status busy={false} text="Save" />
      <Status busy={true} text="Save" />
    </section>
  );
}
