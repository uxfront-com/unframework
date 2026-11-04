export function useToggle(initial: boolean) {
  let on = $state.raw(initial);

  function toggle() {
    on = !on;
  }

  return {
    get on() {
      return on;
    },
    toggle,
  };
}
