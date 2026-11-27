/** Moves the element into the element `to` selects, and removes it on teardown. */
export function teleport(to: string): (element: HTMLElement) => () => void {
  return (element) => {
    const target = document.querySelector(to);
    if (!target) element.remove();
    else {
      const active = document.activeElement;
      target.append(element);
      // Moving a node blurs what it holds, which a component inside it may have focused.
      if (active instanceof HTMLElement && element.contains(active)) active.focus();
    }
    return () => element.remove();
  };
}
