import Badge from "./Badge.uf.tsx";
import Panel from "./Panel.uf.tsx";

// A page that fills an async provider's slot with a child that injects what it provides.
export default function Page() {
  return (
    <main>
      <Panel id="ada">
        <Badge />
      </Panel>
    </main>
  );
}
