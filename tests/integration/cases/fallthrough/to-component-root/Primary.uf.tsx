import Base from "./Base.uf.tsx";

// Its root is a component: a class passed to it passes on to that component's root.
export default function Primary({ text }: { text: string }) {
  return <Base text={text} class="primary" />;
}
