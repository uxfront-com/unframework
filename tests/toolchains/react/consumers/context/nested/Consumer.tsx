import Level from "../../../../../integration/cases/context/nested/__output__/react/Level";

export function Consumer() {
  return (
    <Level title="Book">
      <Level title="Part" />
    </Level>
  );
}
