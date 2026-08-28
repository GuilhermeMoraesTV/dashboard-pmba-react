export const setLatestToggleIntent = (intents, key, intent) => {
  if (!(intents instanceof Map) || key === null || key === undefined) return null;
  intents.set(key, intent);
  return intent;
};

export const takeLatestToggleIntent = (intents, key) => {
  if (!(intents instanceof Map) || !intents.has(key)) return null;
  const intent = intents.get(key);
  intents.delete(key);
  return intent;
};
