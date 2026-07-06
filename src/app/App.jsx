import { useEffect, useMemo, useState } from 'react';
import {
  MdAdd,
  MdClose,
  MdDeleteOutline,
  MdOpenInNew,
  MdRefresh,
  MdSearch,
  MdSettings,
} from 'react-icons/md';
import { appConfig } from 'config/app';
import { settingsStore, useSettings } from 'stores/settingsStore';

const searchEngines = {
  google: 'https://www.google.com/search?q=',
  duckduckgo: 'https://duckduckgo.com/?q=',
  bing: 'https://www.bing.com/search?q=',
};

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getResolvedTheme = (theme) => {
  if (theme !== 'auto') {
    return theme;
  }

  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="time-panel" aria-label="Current time">
      <div className="time">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div className="date">
        {now.toLocaleDateString([], {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </div>
    </section>
  );
}

function Greeting({ name, enabled }) {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return '早上好';
    if (hour < 18) return '下午好';
    return '晚上好';
  }, []);

  if (!enabled) {
    return null;
  }

  return <h1>{name ? `${greeting}, ${name}` : greeting}</h1>;
}

function SearchBox({ engine }) {
  const [query, setQuery] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const value = query.trim();
    if (!value) {
      return;
    }

    const baseUrl = searchEngines[engine] || searchEngines.google;
    window.location.href = `${baseUrl}${encodeURIComponent(value)}`;
  };

  return (
    <form className="search" onSubmit={submit}>
      <MdSearch aria-hidden="true" />
      <input
        aria-label="搜索"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索，或输入网址"
      />
    </form>
  );
}

function Quicklinks({ items, enabled }) {
  if (!enabled || items.length === 0) {
    return null;
  }

  return (
    <nav className="quicklinks" aria-label="快捷链接">
      {items.map((item) => (
        <a key={item.id} href={item.url} rel="noreferrer" className="quicklink">
          <span>{item.title}</span>
          <MdOpenInNew aria-hidden="true" />
        </a>
      ))}
    </nav>
  );
}

function SettingsPanel({ settings, onClose }) {
  const [draftLink, setDraftLink] = useState({ title: '', url: '' });

  const update = (patch) => settingsStore.update(patch);

  const addQuicklink = (event) => {
    event.preventDefault();
    const title = draftLink.title.trim();
    const url = draftLink.url.trim();

    if (!title || !url) {
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    update({
      quicklinks: [
        ...settings.quicklinks,
        { id: createId(), title, url: normalizedUrl },
      ],
    });
    setDraftLink({ title: '', url: '' });
  };

  const removeQuicklink = (id) => {
    update({
      quicklinks: settings.quicklinks.filter((item) => item.id !== id),
    });
  };

  return (
    <aside className="settings-panel" aria-label="设置">
      <div className="settings-header">
        <div>
          <span className="eyebrow">{appConfig.name}</span>
          <h2>设置</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭设置">
          <MdClose />
        </button>
      </div>

      <div className="settings-section">
        <label>
          称呼
          <input
            value={settings.greetingName}
            onChange={(event) => update({ greetingName: event.target.value })}
            placeholder="你的名字"
          />
        </label>

        <label>
          主题
          <select value={settings.theme} onChange={(event) => update({ theme: event.target.value })}>
            <option value="auto">跟随系统</option>
            <option value="dark">深色</option>
            <option value="light">浅色</option>
          </select>
        </label>

        <label>
          搜索引擎
          <select
            value={settings.searchEngine}
            onChange={(event) => update({ searchEngine: event.target.value })}
          >
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
          </select>
        </label>
      </div>

      <div className="settings-section">
        <label>
          背景
          <select
            value={settings.backgroundMode}
            onChange={(event) => update({ backgroundMode: event.target.value })}
          >
            <option value="gradient">渐变</option>
            <option value="color">纯色</option>
            <option value="image">图片链接</option>
          </select>
        </label>

        {settings.backgroundMode === 'color' && (
          <label>
            颜色
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(event) => update({ backgroundColor: event.target.value })}
            />
          </label>
        )}

        {settings.backgroundMode === 'image' && (
          <label>
            图片链接
            <input
              value={settings.backgroundImageUrl}
              onChange={(event) => update({ backgroundImageUrl: event.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </label>
        )}
      </div>

      <div className="settings-section switches">
        <label>
          <input
            type="checkbox"
            checked={settings.showGreeting}
            onChange={(event) => update({ showGreeting: event.target.checked })}
          />
          问候语
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.showQuicklinks}
            onChange={(event) => update({ showQuicklinks: event.target.checked })}
          />
          快捷链接
        </label>
      </div>

      <div className="settings-section">
        <div className="section-title">快捷链接</div>
        <form className="quicklink-form" onSubmit={addQuicklink}>
          <input
            value={draftLink.title}
            onChange={(event) => setDraftLink({ ...draftLink, title: event.target.value })}
            placeholder="名称"
          />
          <input
            value={draftLink.url}
            onChange={(event) => setDraftLink({ ...draftLink, url: event.target.value })}
            placeholder="example.com"
          />
          <button type="submit" aria-label="Add quick link">
            <MdAdd />
          </button>
        </form>

        <div className="quicklink-list">
          {settings.quicklinks.map((item) => (
            <div className="quicklink-row" key={item.id}>
              <span>{item.title}</span>
          <button
                className="icon-button"
                type="button"
                onClick={() => removeQuicklink(item.id)}
                aria-label={`移除 ${item.title}`}
              >
                <MdDeleteOutline />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button className="reset-button" type="button" onClick={() => settingsStore.reset()}>
        <MdRefresh />
        重置设置
      </button>
    </aside>
  );
}

function App() {
  const settings = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const resolvedTheme = getResolvedTheme(settings.theme);
  const backgroundStyle = useMemo(() => {
    if (settings.backgroundMode === 'color') {
      return { background: settings.backgroundColor };
    }

    if (settings.backgroundMode === 'image' && settings.backgroundImageUrl) {
      return {
        backgroundImage: `linear-gradient(120deg, rgb(8 13 23 / 72%), rgb(35 24 37 / 52%)), url("${settings.backgroundImageUrl}")`,
      };
    }

    return {};
  }, [settings.backgroundColor, settings.backgroundImageUrl, settings.backgroundMode]);

  useEffect(() => {
    document.title = appConfig.name;
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  return (
    <main className="new-tab" style={backgroundStyle}>
      <button
        className="settings-trigger"
        type="button"
        onClick={() => setSettingsOpen(true)}
        aria-label="打开设置"
      >
        <MdSettings />
      </button>

      <section className="workspace" aria-label="新标签页面板">
        <Greeting name={settings.greetingName} enabled={settings.showGreeting} />
        <Clock />
        <SearchBox engine={settings.searchEngine} />
        <Quicklinks items={settings.quicklinks} enabled={settings.showQuicklinks} />
      </section>

      {settingsOpen && <SettingsPanel settings={settings} onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}

export default App;
