import { FEATURE_KEYS, type FeatureKey } from "./feature-catalog";

export function applyFeatureSelection(
  selected: readonly FeatureKey[],
  key: FeatureKey,
  enabled: boolean,
): FeatureKey[] {
  const normalized = [...new Set(selected.filter((item) => FEATURE_KEYS.includes(item)))];
  if (!FEATURE_KEYS.includes(key)) return normalized;

  if (enabled) {
    return normalized.includes(key) ? normalized : [...normalized, key];
  }

  return normalized.filter((item) => item !== key);
}
