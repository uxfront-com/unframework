export function once<E extends Event>(handler: (event: E) => unknown): (event: E) => void {
  let ran = false;
  return (event) => {
    if (ran) return;
    ran = true;
    handler(event);
  };
}
