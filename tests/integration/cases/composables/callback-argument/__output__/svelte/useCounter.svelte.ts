export function useCounter(limit: number, onLimit: (count: number) => void) {
  let count = $state(0);
  const step = 1;

  function increment() {
    count += step;
    if (count === limit) onLimit(count);
  }

  function reset() {
    count = 0;
  }

  return {
    get count() {
      return count;
    },
    step,
    increment,
    reset,
  };
}
