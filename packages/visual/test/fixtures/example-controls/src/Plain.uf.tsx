export default function Plain({ tags = [] }: { tags?: Array<string> }) {
  return <p data-plain>{tags.join(", ")}</p>;
}
