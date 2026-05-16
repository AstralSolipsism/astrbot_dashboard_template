<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePluginPageMetadataCache } from '@/composables/usePluginPageMetadataCache'
import { useModuleI18n } from '@/i18n/composables'
import type {
  PluginPageMetadataCacheEntry,
  PluginSummary
} from './types'
import PluginPageFrame from '@/components/extension/plugin-page/PluginPageFrame.vue'

const props = withDefaults(
  defineProps<{
    plugin?: PluginSummary | null
    pluginName?: string
    active?: boolean
  }>(),
  {
    plugin: null,
    pluginName: '',
    active: false
  }
)

const { tm } = useModuleI18n('features/extension')
const metadataCache = usePluginPageMetadataCache()

const metadataEntry = ref<PluginPageMetadataCacheEntry | null>(null)
const loading = ref(false)
let loadToken = 0

const resolvedPluginName = computed(() =>
  String(props.plugin?.name || props.pluginName || '').trim()
)

const isPluginDisabled = computed(() => {
  if (props.plugin) return !props.plugin.activated
  if (metadataEntry.value?.plugin) return !metadataEntry.value.plugin.activated
  return false
})

const pageComponent = computed(() => metadataEntry.value?.page || null)

const pageName = computed(() =>
  String(pageComponent.value?.page_name || pageComponent.value?.name || '').trim()
)

const error = computed(() =>
  isPluginDisabled.value ? '' : metadataEntry.value?.error || ''
)

const pluginData = computed(() => metadataEntry.value?.plugin || null)

const shouldLoadMetadata = computed(
  () => props.active && Boolean(resolvedPluginName.value) && !isPluginDisabled.value
)

const canRenderPageFrame = computed(
  () =>
    props.active &&
    Boolean(resolvedPluginName.value) &&
    Boolean(pluginData.value) &&
    !isPluginDisabled.value &&
    Boolean(pageName.value)
)

function resetInactiveState() {
  loading.value = false
  metadataEntry.value = metadataCache.get(resolvedPluginName.value) || null
}

async function loadMetadata(force = false) {
  const pluginName = resolvedPluginName.value
  const token = loadToken + 1
  loadToken = token

  if (!shouldLoadMetadata.value || !pluginName) {
    resetInactiveState()
    return
  }

  if (force) {
    metadataCache.invalidate(pluginName)
    metadataEntry.value = null
  } else {
    const cachedEntry = metadataCache.get(pluginName)
    if (cachedEntry && !metadataCache.isStale(pluginName)) {
      metadataEntry.value = cachedEntry
      loading.value = false
      return
    }
    metadataEntry.value = cachedEntry || metadataEntry.value
  }

  loading.value = true

  try {
    const entry = await metadataCache.getOrFetch(pluginName, { force })
    if (token !== loadToken) return
    metadataEntry.value = entry
  } catch {
    if (token !== loadToken) return
    metadataEntry.value = metadataCache.get(pluginName) || null
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

watch(
  () => [props.active, resolvedPluginName.value, props.plugin?.activated, props.plugin?.version],
  () => {
    void loadMetadata()
  },
  { immediate: true }
)
</script>

<template>
  <div class="plugin-webui-panel">
    <div class="plugin-webui-panel__header">
      <div class="text-subtitle-1 font-weight-medium">
        {{ tm("modManager.panelTabs.pluginWebUI") }}
      </div>
      <v-spacer />
      <v-btn
        v-if="error"
        size="small"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-refresh"
        @click="loadMetadata(true)"
      >
        {{ tm("modManager.pluginWebUI.actions.retry") }}
      </v-btn>
    </div>

    <v-divider />

    <div class="plugin-webui-panel__body">
      <div v-if="!active" class="plugin-webui-panel__state" />

      <div v-else-if="loading" class="plugin-webui-panel__state">
        <v-progress-circular indeterminate color="primary" />
        <span>{{ tm("status.loading") }}</span>
      </div>

      <div v-else-if="error" class="plugin-webui-panel__state plugin-webui-panel__state--padded">
        <v-alert type="error" variant="tonal" class="mb-4">
          {{ error }}
        </v-alert>
        <v-btn color="primary" variant="tonal" @click="loadMetadata(true)">
          {{ tm("modManager.pluginWebUI.actions.retry") }}
        </v-btn>
      </div>

      <div v-else-if="isPluginDisabled" class="plugin-webui-panel__state plugin-webui-panel__state--padded">
        <v-icon size="56" color="warning" class="mb-3">mdi-power-plug-off-outline</v-icon>
        <div class="text-body-1 text-medium-emphasis">
          {{ tm("messages.pluginDisabled") }}
        </div>
      </div>

      <div v-else-if="!pageName" class="plugin-webui-panel__state plugin-webui-panel__state--padded">
        <v-icon size="56" color="info" class="mb-3">mdi-monitor-off</v-icon>
        <div class="text-body-1 text-medium-emphasis">
          {{ tm("modManager.pluginWebUI.empty.title") }}
        </div>
        <div class="text-body-2 text-disabled mt-1">
          {{ tm("modManager.pluginWebUI.empty.subtitle") }}
        </div>
      </div>

      <PluginPageFrame
        v-else
        :plugin-name="resolvedPluginName"
        :page-name="pageName"
        :plugin-data="pluginData || undefined"
        :active="canRenderPageFrame"
        embedded
      />
    </div>
  </div>
</template>

<style scoped>
.plugin-webui-panel {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.plugin-webui-panel__header {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  min-height: 56px;
  padding: 0 16px;
}

.plugin-webui-panel__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.plugin-webui-panel__state {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  justify-content: center;
  min-height: 0;
}

.plugin-webui-panel__state--padded {
  flex-direction: column;
  padding: 24px;
  text-align: center;
}
</style>
