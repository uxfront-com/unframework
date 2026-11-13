import Card from "../src/Card.uf.tsx";

export default function CardExample() {
  return (
    <Card>
      {{
        header: () => <h2>Release notes</h2>,
        default: () => <p>Every example renders on every target.</p>,
        footer: () => <small>By Ada</small>,
      }}
    </Card>
  );
}
