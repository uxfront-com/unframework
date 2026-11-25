import Primary from "./Primary.uf.tsx";

export default function Toolbar() {
  return (
    <div role="toolbar" aria-label="Actions">
      <Primary text="Save" class="wide" />
    </div>
  );
}
