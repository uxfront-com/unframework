// UF4003 component-host: on Angular, `Row`'s root renders inside its `uf-row` host, so the
// sheet's `.list > .row` and `.row:first-child`, which reach into it, match the host's place.
import "./List.css";
import Row from "./Row.uf.tsx";

export default function List() {
  return (
    <div class="list">
      <Row text="One" />
      <Row text="Two" />
    </div>
  );
}
