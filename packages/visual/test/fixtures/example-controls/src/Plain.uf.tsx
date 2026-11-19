export default function Plain({ tags = [] }: { tags?: string[] }) {
  return <p data-plain>{tags.join(", ")}</p>;
}
