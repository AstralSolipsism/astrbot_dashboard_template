<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import PluginPageFrame from "@/components/extension/plugin-page/PluginPageFrame.vue";

const route = useRoute();
const router = useRouter();

const pluginName = computed(() => String(route.params.pluginName || ""));
const pageName = computed(() => String(route.params.pageName || ""));

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/extension#installed");
};
</script>

<template>
  <div class="plugin-page-page">
    <PluginPageFrame
      :plugin-name="pluginName"
      :page-name="pageName"
      :active="true"
      @back="goBack"
    />
  </div>
</template>
