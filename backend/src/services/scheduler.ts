type Pair = { a: number; b: number };

export function roundRobin(teamIds: number[]): Pair[] {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push(-1);
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Pair[] = [];
  let arr = [...ids];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== -1 && b !== -1) fixtures.push({ a, b });
    }
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return fixtures;
}
