import type { PluginSummary } from './types'

export function sortPluginsByPinned(
  plugins: PluginSummary[],
  pinnedNames?: string[]
): PluginSummary[] {
  if (!pinnedNames || pinnedNames.length === 0) return [...plugins]

  const pinnedSet = new Set(pinnedNames)
  const pinned = plugins.filter((plugin) => pinnedSet.has(plugin.name))
  const unpinned = plugins.filter((plugin) => !pinnedSet.has(plugin.name))
  return [...pinned, ...unpinned]
}

export function getPluginWebUIPrefetchNames(
  plugins: PluginSummary[],
  selectedPluginName: string | null,
  pinnedNames?: string[]
): string[] {
  if (!selectedPluginName) return []

  const activePlugins = sortPluginsByPinned(
    (plugins ?? []).filter((plugin) => plugin.activated),
    pinnedNames
  )
  const selectedIndex = activePlugins.findIndex(
    (plugin) => plugin.name === selectedPluginName
  )
  if (selectedIndex < 0) return []

  return [selectedIndex - 1, selectedIndex, selectedIndex + 1]
    .filter((index) => index >= 0 && index < activePlugins.length)
    .map((index) => activePlugins[index].name)
}
