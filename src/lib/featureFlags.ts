export function isAIEnabled(): boolean {
  const g = globalThis as { __FLOWSTATE_ENABLE_AI?: boolean } | undefined;
  return Boolean(g?.__FLOWSTATE_ENABLE_AI);
}
