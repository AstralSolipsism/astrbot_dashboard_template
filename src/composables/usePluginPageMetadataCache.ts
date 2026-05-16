import axios from 'axios'
import type {
  ApiResponse,
  PluginPageComponent,
  PluginPageMetadataCacheApi,
  PluginPageMetadataCacheEntry
} from '@/components/extension/mod-manager/types'

const DEFAULT_TTL_MS = 10 * 60 * 1000
const MAX_PREFETCH_CONCURRENCY = 2

type PluginDetailPayload = Record<string, any> & {
  name?: string
  activated?: boolean
  version?: string
  components?: unknown
}

type PluginDetailResponse = ApiResponse<PluginDetailPayload | null>

type FetchPriority = 'foreground' | 'prefetch'

type FetchTask = {
  pluginName: string
  entry: PluginPageMetadataCacheEntry
  priority: FetchPriority
  resolve: () => void
  reject: (error: unknown) => void
}

const componentGroupOrder = ['page', 'skill', 'command', 'llm_tool', 'listener', 'hook']
const cache = new Map<string, PluginPageMetadataCacheEntry>()
const queue: FetchTask[] = []
let activeFetches = 0

function now() {
  return Date.now()
}

function getComponentGroupKey(component: any): string {
  return String(component?.type || component?.component_type || '').trim().toLowerCase()
}

function normalizeComponent(component: any, fallbackType = ''): PluginPageComponent {
  const type = fallbackType || getComponentGroupKey(component)
  const normalized = { ...component, type }
  if (component?.type && component.type !== type && !normalized.display_type) {
    normalized.display_type = component.type
  }
  return normalized
}

function normalizeComponentList(source: PluginDetailPayload | null): PluginPageComponent[] {
  if (!source || typeof source !== 'object') return []
  const { components } = source

  if (components && typeof components === 'object' && !Array.isArray(components)) {
    return componentGroupOrder.flatMap((key) => {
      const group = (components as Record<string, unknown>)[key]
      return Array.isArray(group)
        ? group
            .filter((component) => component && typeof component === 'object')
            .map((component) => normalizeComponent(component, key))
        : []
    })
  }

  if (Array.isArray(components)) {
    return components
      .filter((component) => component && typeof component === 'object')
      .map((component) => normalizeComponent(component))
  }

  return []
}

function getPageName(component: PluginPageComponent | null): string {
  return String(component?.page_name || component?.name || '').trim()
}

function getPageComponents(plugin: PluginDetailPayload | null): PluginPageComponent[] {
  return normalizeComponentList(plugin).filter(
    (component) => getComponentGroupKey(component) === 'page' && Boolean(getPageName(component))
  )
}

function ensureEntry(pluginName: string): PluginPageMetadataCacheEntry {
  const existing = cache.get(pluginName)
  if (existing) return existing

  const entry: PluginPageMetadataCacheEntry = {
    pluginName,
    plugin: null,
    components: [],
    page: null,
    hasPage: false,
    error: '',
    fetchedAt: 0
  }
  cache.set(pluginName, entry)
  return entry
}

function isStaleInternal(entry: PluginPageMetadataCacheEntry, ttlMs: number) {
  if (!entry.fetchedAt) return true
  return now() - entry.fetchedAt > ttlMs
}

async function fetchPluginDetail(pluginName: string): Promise<PluginDetailPayload | null> {
  const response = await axios.get<PluginDetailResponse>('/api/plugin/detail', {
    params: { name: pluginName }
  })

  if (response.data?.status === 'error') {
    const message = response.data?.message || 'Failed to fetch plugin detail'
    throw new Error(message)
  }

  return response.data?.data || null
}

function applyPluginDetail(entry: PluginPageMetadataCacheEntry, plugin: PluginDetailPayload | null) {
  const components = getPageComponents(plugin)
  entry.plugin = plugin
  entry.components = components
  entry.page = components[0] || null
  entry.hasPage = Boolean(entry.page)
  entry.error = plugin ? '' : 'Plugin not found'
  entry.activated = plugin?.activated
  entry.version = plugin?.version
  entry.fetchedAt = now()
}

function applyFetchError(entry: PluginPageMetadataCacheEntry, error: unknown) {
  entry.plugin = null
  entry.components = []
  entry.page = null
  entry.hasPage = false
  entry.error =
    (error as any)?.response?.data?.message ||
    (error as any)?.message ||
    'Failed to fetch plugin detail'
}

function dequeueNextTask(): FetchTask | undefined {
  const foregroundIndex = queue.findIndex((task) => task.priority === 'foreground')
  const index = foregroundIndex >= 0 ? foregroundIndex : 0
  return queue.splice(index, 1)[0]
}

function drainQueue() {
  while (activeFetches < MAX_PREFETCH_CONCURRENCY && queue.length > 0) {
    const task = dequeueNextTask()
    if (!task) return

    activeFetches += 1
    fetchPluginDetail(task.pluginName)
      .then((plugin) => {
        applyPluginDetail(task.entry, plugin)
        task.resolve()
      })
      .catch((error) => {
        applyFetchError(task.entry, error)
        task.reject(error)
      })
      .finally(() => {
        activeFetches -= 1
        drainQueue()
      })
  }
}

function startRefresh(
  pluginName: string,
  entry: PluginPageMetadataCacheEntry,
  priority: FetchPriority
) {
  if (entry.inFlight) return entry.inFlight

  let resolveTask!: () => void
  let rejectTask!: (error: unknown) => void
  const taskPromise = new Promise<void>((resolve, reject) => {
    resolveTask = resolve
    rejectTask = reject
  })

  const wrapped = taskPromise.finally(() => {
    if (entry.inFlight === wrapped) {
      entry.inFlight = undefined
    }
  })

  entry.error = ''
  entry.inFlight = wrapped
  queue.push({
    pluginName,
    entry,
    priority,
    resolve: resolveTask,
    reject: rejectTask
  })
  drainQueue()
  return wrapped
}

export function usePluginPageMetadataCache(options?: { ttlMs?: number }): PluginPageMetadataCacheApi {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS

  function get(pluginName: string) {
    return cache.get(pluginName)
  }

  function invalidate(pluginName: string) {
    cache.delete(pluginName)
  }

  function clear() {
    const pendingTasks = queue.splice(0, queue.length)
    pendingTasks.forEach((task) => {
      task.reject(new Error('Plugin page metadata cache cleared'))
    })
    cache.clear()
  }

  function isStale(pluginName: string) {
    const entry = cache.get(pluginName)
    if (!entry) return true
    return isStaleInternal(entry, ttlMs)
  }

  async function getOrFetch(
    pluginName: string,
    options?: { force?: boolean; priority?: FetchPriority }
  ): Promise<PluginPageMetadataCacheEntry> {
    const entry = ensureEntry(pluginName)
    const hasValue = Boolean(entry.fetchedAt)

    if (!options?.force && hasValue && !isStaleInternal(entry, ttlMs)) {
      return entry
    }

    await startRefresh(pluginName, entry, options?.priority ?? 'foreground')
    return entry
  }

  async function prefetch(pluginName: string): Promise<void> {
    try {
      await getOrFetch(pluginName, { priority: 'prefetch' })
    } catch {
      // Metadata prefetch is opportunistic and must not block plugin selection.
    }
  }

  async function prefetchMany(pluginNames: string[]): Promise<void> {
    const uniqueNames = Array.from(new Set(pluginNames.filter(Boolean)))
    await Promise.all(uniqueNames.map((pluginName) => prefetch(pluginName)))
  }

  return {
    get,
    prefetch,
    prefetchMany,
    getOrFetch,
    invalidate,
    clear,
    isStale
  }
}
