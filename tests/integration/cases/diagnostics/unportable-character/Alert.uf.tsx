// UF3010 unportable-character: a control character (U+0007, BEL), which HTML does not keep.
export default function Alert() {
  return <p>Ding&#7; you have mail</p>;
}
