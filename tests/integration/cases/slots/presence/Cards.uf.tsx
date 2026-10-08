import Card from "./Card.uf.tsx";

export default function Cards() {
  return (
    <div class="cards">
      <Card label="Full">
        {{ title: () => <h3>Weather</h3>, default: () => <p>Sunny, 21°</p> }}
      </Card>
      <Card label="Bare" />
    </div>
  );
}
