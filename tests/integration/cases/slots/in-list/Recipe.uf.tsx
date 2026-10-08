import Steps from "./Steps.uf.tsx";

export default function Recipe({ steps }: { steps: string[] }) {
  return (
    <div>
      <Steps steps={steps}>{{ marker: () => <span aria-hidden="true">&gt; </span> }}</Steps>
    </div>
  );
}
