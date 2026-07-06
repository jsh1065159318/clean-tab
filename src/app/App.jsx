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
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
        aria-label="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search or type a URL"
      />
    </form>
  );
}

function Quicklinks({ items, enabled }) {
  if (!enabled || items.length === 0) {
    return null;
  }

  return (
    <nav className="quicklinks" aria-label="Quick links">
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
    <aside className="settings-panel" aria-label="Settings">
      <div className="settings-header">
        <div>
          <span className="eyebrow">{appConfig.name}</span>
          <h2>Settings</h2>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">
          <MdClose />
        </button>
      </div>

      <div className="settings-section">
        <label>
          Name
          <input
            value={settings.greetingName}
            onChange={(event) => update({ greetingName: event.target.value })}
            placeholder="Your name"
          />
        </label>

        <label>
          Theme
          <select value={settings.theme} onChange={(event) => update({ theme: event.target.value })}>
            <option value="auto">Auto</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>

        <label>
          Search
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
          Background
          <select
            value={settings.backgroundMode}
            onChange={(event) => update({ backgroundMode: event.target.value })}
          >
            <option value="gradient">Gradient</option>
            <option value="color">Color</option>
            <option value="image">Image URL</option>
          </select>
        </label>

        {settings.backgroundMode === 'color' && (
          <label>
            Color
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(event) => update({ backgroundColor: event.target.value })}
            />
          </label>
        )}

        {settings.backgroundMode === 'image' && (
          <label>
            Image URL
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
          Greeting
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.showQuicklinks}
            onChange={(event) => update({ showQuicklinks: event.target.checked })}
          />
          Quick links
        </label>
      </div>

      <div className="settings-section">
        <div className="section-title">Quick links</div>
        <form className="quicklink-form" onSubmit={addQuicklink}>
          <input
            value={draftLink.title}
            onChange={(event) => setDraftLink({ ...draftLink, title: event.target.value })}
            placeholder="Title"
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
                aria-label={`Remove ${item.title}`}
              >
                <MdDeleteOutline />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button className="reset-button" type="button" onClick={() => settingsStore.reset()}>
        <MdRefresh />
        Reset settings
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
        aria-label="Open settings"
      >
        <MdSettings />
      </button>

      <section className="workspace" aria-label="New tab dashboard">
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
