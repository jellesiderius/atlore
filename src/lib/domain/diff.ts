export interface DiffPart {
  value: string;
  kind: 'same' | 'added' | 'removed';
}

export function diffWords(previous: string, current: string, maxWords = 1_500): DiffPart[] | null {
  const a = previous.trim().split(/\s+/u).filter(Boolean);
  const b = current.trim().split(/\s+/u).filter(Boolean);
  if (a.length + b.length > maxWords) return null;
  const matrix = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      matrix[i][j] =
        a[i] === b[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
  const result: DiffPart[] = [];
  const push = (value: string, kind: DiffPart['kind']) => {
    const last = result.at(-1);
    if (last?.kind === kind) last.value += ` ${value}`;
    else result.push({ value, kind });
  };
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i++], 'same');
      j++;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) push(a[i++], 'removed');
    else push(b[j++], 'added');
  }
  while (i < a.length) push(a[i++], 'removed');
  while (j < b.length) push(b[j++], 'added');
  return result;
}
