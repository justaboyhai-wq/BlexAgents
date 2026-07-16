export function completedSpeechPrefix(text: string, offset: number): { segment: string; nextOffset: number } {
  const rest = text.slice(offset);
  let boundary = -1;
  for (let index = 0; index < rest.length; index++) {
    if ('。！？!?；;\n'.includes(rest[index])) boundary = index + 1;
  }
  return boundary < 0
    ? { segment: '', nextOffset: offset }
    : { segment: rest.slice(0, boundary).trim(), nextOffset: offset + boundary };
}
