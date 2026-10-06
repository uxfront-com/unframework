// UF3012 jsx-outside-template: a helper function returns JSX outside every component's template.
function renderIcon() {
  return <span class="icon">*</span>;
}

export default function Toolbar() {
  return (
    <div role="toolbar" aria-label="Formatting">
      <button type="button">Bold</button>
    </div>
  );
}
