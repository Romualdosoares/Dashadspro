import { getFeatureDefinition, FEATURE_KEYS, type FeatureKey } from "./feature-catalog";

export type ClientNavigationItem = Readonly<{
  key: FeatureKey;
  href: string;
  label: string;
  icon: string;
}>;

export function getClientNavigation(enabledFeatureKeys: readonly string[]): ClientNavigationItem[] {
  const enabledKeys = new Set(enabledFeatureKeys);

  return FEATURE_KEYS.flatMap((key) => {
    if (!enabledKeys.has(key)) {
      return [];
    }

    const definition = getFeatureDefinition(key);
    if (definition === null) {
      return [];
    }

    return [{
      key: definition.key,
      href: definition.route,
      label: definition.defaultName,
      icon: definition.icon,
    }];
  });
}
