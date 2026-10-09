import Level from "./Level.uf.tsx";

export default function Outline() {
  return (
    <Level title="Book">
      <Level title="Part">
        <Level title="Chapter" />
      </Level>
      <Level title="Appendix" />
    </Level>
  );
}
