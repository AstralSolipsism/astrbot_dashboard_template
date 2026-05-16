<script setup>
import { computed } from "vue";
import { usePluginPageFrame } from "@/composables/usePluginPageFrame";
import { useModuleI18n } from "@/i18n/composables";

const props = defineProps({
  pluginName: {
    type: String,
    required: true,
  },
  pageName: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  embedded: {
    type: Boolean,
    default: false,
  },
  pluginData: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["back"]);

const { tm } = useModuleI18n("features/extension");

const {
  loading,
  errorMessage,
  iframeSrc,
  iframeRef,
  localizedPageTitle,
  loadPluginPage,
  handleIframeLoad,
} = usePluginPageFrame({
  pluginName: computed(() => props.pluginName),
  pageName: computed(() => props.pageName),
  active: computed(() => props.active),
  pluginData: computed(() => props.pluginData),
});
</script>

<template>
  <div
    class="plugin-page-frame-host"
    :class="{ 'plugin-page-frame-host--embedded': embedded }"
  >
    <div
      v-if="!embedded"
      class="d-flex align-center flex-wrap mb-4"
      style="gap: 12px"
    >
      <v-btn
        variant="tonal"
        color="primary"
        prepend-icon="mdi-arrow-left"
        @click="emit('back')"
      >
        {{ tm("buttons.back") }}
      </v-btn>

      <div>
        <div class="text-h2 mb-1">
          {{ localizedPageTitle }}
        </div>
      </div>
    </div>

    <v-card
      class="plugin-page-frame-card"
      :class="{ 'plugin-page-frame-card--embedded': embedded }"
      elevation="0"
    >
      <v-card-text class="pa-0 plugin-page-frame-card__body">
        <div v-if="!active" class="plugin-page-frame-state" />

        <div v-else-if="loading" class="plugin-page-frame-state">
          <v-progress-circular indeterminate color="primary" />
          <span>{{ tm("status.loading") }}</span>
        </div>

        <div v-else-if="errorMessage" class="pa-6">
          <v-alert type="error" variant="tonal" class="mb-4">
            {{ errorMessage }}
          </v-alert>
          <v-btn color="primary" variant="tonal" @click="loadPluginPage">
            {{ tm("modManager.pluginWebUI.actions.retry") }}
          </v-btn>
        </div>

        <iframe
          v-else
          ref="iframeRef"
          :src="iframeSrc"
          class="plugin-page-frame"
          :class="{ 'plugin-page-frame--embedded': embedded }"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-forms allow-downloads"
          @load="handleIframeLoad"
        ></iframe>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.plugin-page-frame-host {
  min-width: 0;
}

.plugin-page-frame-host--embedded {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.plugin-page-frame-card {
  background-color: rgb(var(--v-theme-surface));
  border-radius: 16px;
  overflow: hidden;
}

.plugin-page-frame-card--embedded {
  border-radius: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.plugin-page-frame-card__body {
  min-height: 0;
}

.plugin-page-frame-card--embedded .plugin-page-frame-card__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
}

.plugin-page-frame {
  background: transparent;
  border: 0;
  min-height: calc(100vh - 220px);
  width: 100%;
}

.plugin-page-frame--embedded {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
}

.plugin-page-frame-state {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: center;
  min-height: calc(100vh - 220px);
}

.plugin-page-frame-host--embedded .plugin-page-frame-state {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
