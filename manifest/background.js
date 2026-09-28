/* eslint-disable no-undef */
const extensionApi = typeof browser === 'undefined' ? chrome : browser;
const contextMenus = extensionApi.contextMenus;

const isNavigablePage = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const captureUrl = (mode, tab) => {
  if (!tab?.url || !isNavigablePage(tab.url)) return;
  const params = new URLSearchParams({
    capture: mode,
    url: tab.url.slice(0, 2048),
    title: (tab.title || '').trim().slice(0, 200),
  });
  void extensionApi.tabs.create({
    url: `${extensionApi.runtime.getURL('index.html')}?${params.toString()}`,
  });
};

let contextMenuSetupPromise = null;

const setupContextMenus = () => {
  if (contextMenuSetupPromise) return contextMenuSetupPromise;
  contextMenuSetupPromise = (async () => {
    if (!contextMenus?.onClicked) return;
    try {
      await extensionApi.contextMenus.removeAll();
    } catch {
      // Continue creating menus when an older browser does not support removeAll promises.
    }
    await Promise.all([
      extensionApi.contextMenus.create({
        id: 'clean-tab-save-shortcut',
        title: '保存到清爽标签页（快捷方式）',
        contexts: ['page'],
        documentUrlPatterns: ['http://*/*', 'https://*/*'],
      }),
      extensionApi.contextMenus.create({
        id: 'clean-tab-save-task',
        title: '保存到清爽标签页（任务）',
        contexts: ['page'],
        documentUrlPatterns: ['http://*/*', 'https://*/*'],
      }),
    ]);
  })().finally(() => {
    contextMenuSetupPromise = null;
  });
  return contextMenuSetupPromise;
};

contextMenus?.onClicked?.addListener((info, tab) => {
  if (info.menuItemId === 'clean-tab-save-shortcut') captureUrl('shortcut', tab);
  if (info.menuItemId === 'clean-tab-save-task') captureUrl('task', tab);
});

void setupContextMenus();

extensionApi.runtime.onInstalled.addListener((details) => {
  void setupContextMenus();
  if (details.reason === 'install') {
    extensionApi.tabs.create({
      url: extensionApi.runtime.getURL('index.html'),
    });
  }
});

extensionApi.action.onClicked.addListener(() => {
  extensionApi.tabs.create({
    url: extensionApi.runtime.getURL('index.html'),
  });
});
