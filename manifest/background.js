/* eslint-disable no-undef */
const extensionApi = typeof browser === 'undefined' ? chrome : browser;

extensionApi.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    extensionApi.tabs.create({
      url: extensionApi.runtime.getURL('index.html'),
    });
  }
});
