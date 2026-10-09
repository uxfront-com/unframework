import { useRef, useState } from "react";

export default function ColourList() {
  const [colour, setColour] = useState("none");
  const colourRef = useRef(colour);

  return (
    <section aria-label="Colours">
      <select
        size={3}
        aria-label="Colour"
        onChange={(event) => {
          colourRef.current = (event.currentTarget as HTMLSelectElement).value;
          setColour(colourRef.current);
        }}
      >
        <option value="red">Red</option>
        <option value="green">Green</option>
        <option value="blue">Blue</option>
      </select>
      <output>Picked: {colour}</output>
    </section>
  );
}
