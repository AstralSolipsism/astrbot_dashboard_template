import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('manager tab label is Plugin WebUI and no longer the old extension area label', () => {
  const zh = JSON.parse(read('../src/i18n/locales/zh-CN/features/extension.json'));
  const en = JSON.parse(read('../src/i18n/locales/en-US/features/extension.json'));
  const ru = JSON.parse(read('../src/i18n/locales/ru-RU/features/extension.json'));

  assert.equal(zh.modManager.panelTabs.pluginWebUI, '插件WebUI');
  assert.equal(en.modManager.panelTabs.pluginWebUI, 'Plugin WebUI');
  assert.equal(ru.modManager.panelTabs.pluginWebUI, 'Plugin WebUI');
  assert.equal(Object.values(zh.modManager.panelTabs).includes('扩展区'), false);
});

test('manager renders PluginWebUIPanel instead of the reserved GlobalPanel placeholder', () => {
  const panel = read('../src/components/extension/mod-manager/PluginPanel.vue');
  const detached = read('../src/components/extension/mod-manager/DetachedTabPane.vue');

  assert.match(panel, /PluginWebUIPanel/);
  assert.match(panel, /value:\s*'pluginWebUI'/);
  assert.doesNotMatch(panel, /GlobalPanel/);
  assert.match(detached, /tab === 'pluginWebUI'/);
  assert.match(detached, /PluginWebUIPanel/);
  assert.doesNotMatch(detached, /GlobalPanel/);
});

test('legacy detached reserved tab is migrated to pluginWebUI', () => {
  const workspace = read('../src/components/extension/mod-manager/PluginWorkspace.vue');

  assert.match(workspace, /stored === 'reserved'/);
  assert.match(workspace, /localStorage\.setItem\(DETACHED_TAB_KEY,\s*'pluginWebUI'\)/);
  assert.match(workspace, /return 'pluginWebUI'/);
});

test('plugin page iframe sandbox follows AstrBot plugin-pages contract', () => {
  const frame = read('../src/components/extension/plugin-page/PluginPageFrame.vue');

  assert.match(frame, /sandbox="allow-scripts allow-forms allow-downloads"/);
  assert.doesNotMatch(frame, /allow-popups/);
  assert.match(frame, /plugin-page-frame--embedded/);
});

test('plugin page metadata cache only fetches plugin detail metadata', () => {
  const metadataCache = read('../src/composables/usePluginPageMetadataCache.ts');

  assert.match(metadataCache, /\/api\/plugin\/detail/);
  assert.doesNotMatch(metadataCache, /\/api\/plugin\/page\/entry/);
  assert.match(metadataCache, /MAX_PREFETCH_CONCURRENCY\s*=\s*2/);
  assert.match(metadataCache, /priority === 'foreground'/);
});

test('plugin page entry loading remains owned by the iframe frame composable', () => {
  const frameComposable = read('../src/composables/usePluginPageFrame.js');
  const metadataCache = read('../src/composables/usePluginPageMetadataCache.ts');
  const panel = read('../src/components/extension/mod-manager/PluginWebUIPanel.vue');

  assert.match(frameComposable, /\/api\/plugin\/page\/entry/);
  assert.doesNotMatch(metadataCache, /\/api\/plugin\/page\/entry/);
  assert.doesNotMatch(panel, /\/api\/plugin\/page\/entry/);
});

test('plugin WebUI prefetch uses active pinned-first neighbors only', () => {
  const helper = read('../src/components/extension/mod-manager/pluginWebUIPrefetch.ts');
  const layout = read('../src/components/extension/mod-manager/ModManagerLayout.vue');

  assert.match(helper, /filter\(\(plugin\) => plugin\.activated\)/);
  assert.match(helper, /\[selectedIndex - 1, selectedIndex, selectedIndex \+ 1\]/);
  assert.match(helper, /sortPluginsByPinned/);
  assert.match(layout, /pageMetadataCache\.prefetchMany\(names\)/);
});

test('PluginWebUIPanel consumes metadata cache instead of fetching detail directly', () => {
  const panel = read('../src/components/extension/mod-manager/PluginWebUIPanel.vue');

  assert.match(panel, /usePluginPageMetadataCache/);
  assert.match(panel, /metadataCache\.getOrFetch/);
  assert.doesNotMatch(panel, /from ['"]axios['"]/);
  assert.doesNotMatch(panel, /\/api\/plugin\/detail/);
});
