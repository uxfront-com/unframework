import Card from "./Card.uf.tsx";

export default function Post({ author }: { author: string }) {
  return (
    <Card>
      {{
        header: () => <h2>Release notes</h2>,
        default: () => <p>Slots arrive in M3.</p>,
        footer: () => <small>By {author}</small>,
      }}
    </Card>
  );
}
