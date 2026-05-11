<script setup lang="ts">
interface ContractCapabilityMarker {
  id: string;
  actions: string[];
}

const capabilityMarkers: ContractCapabilityMarker[] = [
  {
    id: 'home',
    actions: []
  },
  {
    id: 'auth.login',
    actions: []
  },
  {
    id: 'plugin.list',
    actions: ['plugin.update-all', 'plugin.install-entry']
  },
  {
    id: 'plugin.detail',
    actions: ['plugin.enable', 'plugin.disable', 'plugin.reload', 'plugin.uninstall']
  },
  {
    id: 'plugin.market',
    actions: ['plugin.install', 'plugin.upload-install']
  },
  {
    id: 'plugin.page.bridge',
    actions: ['plugin-page.ready', 'plugin-page.api-get', 'plugin-page.api-post']
  },
  {
    id: 'config.manage',
    actions: ['config.save', 'config.restart']
  },
  {
    id: 'provider.manage',
    actions: ['provider.create', 'provider.update', 'provider.check']
  },
  {
    id: 'platform.manage',
    actions: ['platform.create', 'platform.update', 'platform.delete']
  },
  {
    id: 'chat.runtime',
    actions: ['chat.send', 'chat.stop', 'chat.upload']
  },
  {
    id: 'settings.restart',
    actions: ['settings.restart', 'apikey.create', 'backup.open']
  },
  {
    id: 'conversation.history',
    actions: ['conversation.open', 'conversation.export']
  },
  {
    id: 'session.rules',
    actions: ['session-rule.create', 'session-rule.update']
  },
  {
    id: 'persona.manage',
    actions: ['persona.create', 'persona.update', 'persona.delete']
  },
  {
    id: 'subagent.manage',
    actions: ['subagent.save']
  },
  {
    id: 'cron.manage',
    actions: ['cron.create', 'cron.update', 'cron.delete']
  },
  {
    id: 'trace.view',
    actions: ['trace.settings']
  },
  {
    id: 'knowledge-base.manage',
    actions: ['kb.create', 'kb.upload', 'kb.retrieve']
  },
  {
    id: 'commands.tools',
    actions: ['command.toggle', 'tool.toggle', 'mcp.server.add']
  },
  {
    id: 'skills.manage',
    actions: ['skill.upload', 'skill.update', 'skill.delete']
  }
];

const requiredApiAnchors = ['/api/plugin/page/bridge-sdk.js', '/api/plugin/page/content/:plugin_name/:page_name'];
</script>

<template>
  <aside class="dashboard-contract-markers" aria-hidden="true">
    <section
      v-for="capability in capabilityMarkers"
      :key="capability.id"
      :data-astrbot-capability="capability.id"
    >
      <span
        v-for="action in capability.actions"
        :key="action"
        :data-astrbot-action="action"
      ></span>
    </section>
    <span
      v-for="api in requiredApiAnchors"
      :key="api"
      :data-astrbot-api="api"
    ></span>
  </aside>
</template>

<style scoped>
.dashboard-contract-markers {
  position: fixed;
  z-index: 0;
  inset-block-start: 0;
  inset-inline-start: 0;
  overflow: hidden;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}

.dashboard-contract-markers * {
  display: block;
  inline-size: 1px;
  block-size: 1px;
}
</style>
