import Panel from "./Panel.uf.tsx";

export default function Greeting({ name }: { name: string }) {
  return (
    <Panel title="Welcome">
      <p>
        Hello, <strong>{name}</strong>!
      </p>
      <p>Your children render in the panel.</p>
    </Panel>
  );
}
