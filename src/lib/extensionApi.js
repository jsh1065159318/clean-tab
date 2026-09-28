/**
 * Promise-based browser extension API shared by Chrome, Firefox and Safari Web Extensions.
 * Firefox's `browser` implementation is preferred when both globals are available.
 */

const root = globalThis;
const promiseApi = root.browser;
const callbackApi = root.chrome;

const unavailable = (feature) =>
  Promise.reject(new Error(`Extension API is unavailable: ${feature}`));

const callCallbackApi = (invoke) =>
  new Promise((resolve, reject) => {
    try {
      invoke((result) => {
        const runtimeError = callbackApi?.runtime?.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }
        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });

const getNamespace = (api, namespace) =>
  namespace.split('.').reduce((value, key) => value?.[key], api);

const hasPromiseMethod = (namespace, method) =>
  typeof getNamespace(promiseApi, namespace)?.[method] === 'function';

const hasCallbackMethod = (namespace, method) =>
  typeof getNamespace(callbackApi, namespace)?.[method] === 'function';

const callApi = (namespace, method, args = []) => {
  if (hasPromiseMethod(namespace, method)) {
    return getNamespace(promiseApi, namespace)[method](...args);
  }
  if (hasCallbackMethod(namespace, method)) {
    return callCallbackApi((done) => getNamespace(callbackApi, namespace)[method](...args, done));
  }
  return unavailable(`${namespace}.${method}`);
};

const actionNamespace = () => {
  if (promiseApi?.action) return promiseApi.action;
  if (callbackApi?.action) return callbackApi.action;
  return null;
};

const userAgent = root.navigator?.userAgent || '';

export const extensionApi = {
  tabs: {
    query: (queryInfo) => callApi('tabs', 'query', [queryInfo]),
    create: (createProperties) => callApi('tabs', 'create', [createProperties]),
    update: (tabId, updateProperties) =>
      callApi('tabs', 'update', [tabId, updateProperties]),
    remove: (tabId) => callApi('tabs', 'remove', [tabId]),
  },

  storage: {
    local: {
      get: (keys) => callApi('storage.local', 'get', [keys]),
      set: (items) => callApi('storage.local', 'set', [items]),
      remove: (keys) => callApi('storage.local', 'remove', [keys]),
      clear: () => callApi('storage.local', 'clear'),
    },
  },

  contextMenus: {
    removeAll: () => callApi('contextMenus', 'removeAll'),
    create: (createProperties) => callApi('contextMenus', 'create', [createProperties]),
  },

  runtime: {
    getURL(path) {
      const runtime = promiseApi?.runtime || callbackApi?.runtime;
      return runtime?.getURL ? runtime.getURL(path) : path;
    },
    getManifest() {
      const runtime = promiseApi?.runtime || callbackApi?.runtime;
      return runtime?.getManifest ? runtime.getManifest() : null;
    },
    sendMessage: (message) => callApi('runtime', 'sendMessage', [message]),
  },

  action: {
    setIcon(details) {
      const action = actionNamespace();
      return action?.setIcon ? Promise.resolve(action.setIcon(details)) : Promise.resolve();
    },
    setTitle(details) {
      const action = actionNamespace();
      return action?.setTitle ? Promise.resolve(action.setTitle(details)) : Promise.resolve();
    },
    setBadgeText(details) {
      const action = actionNamespace();
      return action?.setBadgeText
        ? Promise.resolve(action.setBadgeText(details))
        : Promise.resolve();
    },
  },

  isExtension: () => Boolean(promiseApi?.runtime?.id || callbackApi?.runtime?.id),
  isChrome: () => Boolean(callbackApi?.runtime?.id) && !/Firefox|Safari\//.test(userAgent),
  isFirefox: () => /Firefox\//.test(userAgent),
  isSafari: () => /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\//.test(userAgent),
};

export default extensionApi;
