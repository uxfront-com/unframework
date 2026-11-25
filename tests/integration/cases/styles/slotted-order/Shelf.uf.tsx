import Amber from "./Amber.uf.tsx";
import Blue from "./Blue.uf.tsx";

// Blue is imported and rendered first, Amber's name sorts first: the children's sheets must load
// in the reference's order whatever the output's own order of use. The `<component is>` reads a
// list's item, so a target may choose it where it sits.
export default function Shelf() {
  const items = [
    { label: "Warm", warm: true },
    { label: "Cool", warm: false },
  ];
  return (
    <section>
      <Blue>
        <p class="caption">In blue</p>
      </Blue>
      <Amber>
        <p class="caption">In amber</p>
      </Amber>
      {items.map((item) => (
        <div key={item.label}>
          <component is={item.warm ? Amber : Blue}>
            <p class="caption">{item.label}</p>
          </component>
        </div>
      ))}
    </section>
  );
}
