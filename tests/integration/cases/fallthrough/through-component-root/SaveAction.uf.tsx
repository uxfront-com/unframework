import Pressable from "./Pressable.uf.tsx";

// Its root is a component: what its consumer passes passes on to that component's root.
export default function SaveAction({ text }: { text: string }) {
  return <Pressable text={text} class="save" />;
}
