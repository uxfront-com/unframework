import "virtual:styleframe.css";

export default function Tag({ label }: { label: string }) {
  return (
    <span class="_padding:lg _background-color:primary _color:on-primary _border-radius:[4px]">
      {label}
    </span>
  );
}
