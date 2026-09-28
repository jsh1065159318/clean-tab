import type { FormEvent, KeyboardEvent, RefObject } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdArrowForward, MdDeleteOutline, MdHistory } from 'react-icons/md'
import type { Shortcut, Todo } from 'features/store/workspaceStore'
import { isSearchEngineId, searchEngineOptions } from 'utils/resolveSearchInput'
import type { SearchEngineId } from 'utils/resolveSearchInput'
import { ShortcutGrid } from './ShortcutGrid'

interface HomeViewProps {
  displayName: string
  recentSearches: string[]
  search: string
  searchEngine: string
  searchInputRef: RefObject<HTMLInputElement | null>
  shortcuts: Shortcut[]
  showGreeting: boolean
  showQuicklinks: boolean
  todos: Todo[]
  onAddShortcut: () => void
  onAddTodo: (text: string) => void
  onChangeSearchEngine: (engine: SearchEngineId) => void
  onDeleteShortcut: (shortcut: Shortcut) => void
  onEditShortcut: (shortcut: Shortcut) => void
  onOpenShortcut: (shortcut: Shortcut) => void
  onOpenTasks: () => void
  onClearRecentSearches: () => void
  onReorderShortcut: (draggedId: string, targetId: string) => void
  onSearchChange: (value: string) => void
  onSearchKeySubmit: () => void
  onSearchSelect: (value: string) => void
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void
  onToggleTodo: (id: string) => void
}

const formatDate = (date: Date) => date.toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

const getGreeting = (date: Date) => {
  const hour = date.getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function HomeView(props: HomeViewProps) {
  const [now, setNow] = useState(() => new Date())
  const [todoDraft, setTodoDraft] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const pendingTodos = props.todos.filter(todo => !todo.done).slice(0, 3)
  const engine: SearchEngineId = isSearchEngineId(props.searchEngine) ? props.searchEngine : 'google'
  const engineLabel = searchEngineOptions.find(option => option.id === engine)?.label ?? 'Google'
  const filteredSearches = useMemo(() => {
    const query = props.search.trim().toLocaleLowerCase()
    return query
      ? props.recentSearches.filter(item => item.toLocaleLowerCase().includes(query))
      : props.recentSearches
  }, [props.recentSearches, props.search])
  const showRecentSearches = searchFocused && filteredSearches.length > 0

  useEffect(() => {
    let timer = 0
    const scheduleNextMinute = () => {
      const current = new Date()
      const delay = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()) + 20
      timer = window.setTimeout(() => {
        setNow(new Date())
        scheduleNextMinute()
      }, delay)
    }
    scheduleNextMinute()
    return () => window.clearTimeout(timer)
  }, [])

  const submitTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = todoDraft.trim()
    if (!value) return
    props.onAddTodo(value)
    setTodoDraft('')
  }

  const selectRecentSearch = (value: string) => {
    setSearchFocused(false)
    setActiveSearchIndex(-1)
    props.onSearchSelect(value)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setSearchFocused(false)
      setActiveSearchIndex(-1)
      return
    }
    if (event.key === 'Enter' && !showRecentSearches) {
      event.preventDefault()
      props.onSearchKeySubmit()
      return
    }
    if (!showRecentSearches || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter')) return
    if (event.key === 'Enter' && activeSearchIndex >= 0) {
      event.preventDefault()
      selectRecentSearch(filteredSearches[activeSearchIndex])
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      props.onSearchKeySubmit()
      return
    }
    event.preventDefault()
    setActiveSearchIndex(current => {
      if (event.key === 'ArrowDown') return current >= filteredSearches.length - 1 ? 0 : current + 1
      return current <= 0 ? filteredSearches.length - 1 : current - 1
    })
  }

  return (
    <main className="home-view">
      <section className="hero" aria-labelledby="home-heading">
        {props.showGreeting && (
          <p className="hero-greeting" id="home-heading">
            {getGreeting(now)}{props.displayName ? `，${props.displayName}` : ''}
          </p>
        )}
        <time className="hero-time" dateTime={now.toISOString()}>
          {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </time>
        <p className="hero-date">{formatDate(now)}</p>

        <div className="search-shell">
          <form className="unified-search" onSubmit={props.onSearchSubmit}>
            <select
              className="search-engine"
              value={engine}
              onChange={event => {
                if (isSearchEngineId(event.target.value)) props.onChangeSearchEngine(event.target.value)
              }}
              aria-label="选择搜索引擎"
              title={`当前搜索引擎：${engineLabel}`}
            >
              {searchEngineOptions.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <input
              ref={props.searchInputRef}
              value={props.search}
              onChange={event => {
                props.onSearchChange(event.target.value)
                setSearchFocused(true)
                setActiveSearchIndex(-1)
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 0)}
              onKeyDown={handleSearchKeyDown}
              placeholder="搜索或输入网址"
              aria-label="搜索或输入网址"
              aria-autocomplete="list"
              aria-controls="recent-search-list"
              aria-expanded={showRecentSearches}
              aria-activedescendant={activeSearchIndex >= 0 ? `recent-search-${activeSearchIndex}` : undefined}
              role="combobox"
              autoComplete="off"
            />
            <kbd>回车</kbd>
          </form>
          {showRecentSearches && (
            <div className="recent-search-popover">
              <div className="recent-search-heading">
                <span>最近搜索</span>
                <button
                  type="button"
                  title="清除最近搜索"
                  aria-label="清除最近搜索"
                  onMouseDown={event => event.preventDefault()}
                  onClick={props.onClearRecentSearches}
                >
                  <MdDeleteOutline />
                </button>
              </div>
              <div id="recent-search-list" role="listbox" aria-label="最近搜索">
                {filteredSearches.map((item, index) => (
                  <button
                    id={`recent-search-${index}`}
                    className={index === activeSearchIndex ? 'active' : ''}
                    key={item}
                    type="button"
                    role="option"
                    aria-selected={index === activeSearchIndex}
                    onMouseDown={event => event.preventDefault()}
                    onMouseEnter={() => setActiveSearchIndex(index)}
                    onClick={() => selectRecentSearch(item)}
                  >
                    <MdHistory aria-hidden="true" />
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="home-content">
        {props.showQuicklinks && (
          <section className="home-section" aria-labelledby="shortcut-heading">
            <div className="section-heading">
              <div>
                <p className="section-kicker">常用入口</p>
                <h2 id="shortcut-heading">快捷方式</h2>
              </div>
            </div>
            <ShortcutGrid
              shortcuts={props.shortcuts}
              onAdd={props.onAddShortcut}
              onDelete={props.onDeleteShortcut}
              onEdit={props.onEditShortcut}
              onOpen={props.onOpenShortcut}
              onReorder={props.onReorderShortcut}
            />
          </section>
        )}

        <section className="focus-card" aria-labelledby="focus-heading">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">保持专注</p>
              <h2 id="focus-heading">今日重点</h2>
            </div>
            <button className="text-button" type="button" onClick={props.onOpenTasks}>
              全部任务 <MdArrowForward />
            </button>
          </div>

          <form className="quick-task-form" onSubmit={submitTodo}>
            <input
              value={todoDraft}
              onChange={event => setTodoDraft(event.target.value)}
              placeholder="添加一件要完成的事"
              aria-label="添加任务"
            />
            <button type="submit" aria-label="添加任务"><MdAdd /></button>
          </form>

          <div className="focus-list">
            {pendingTodos.length === 0 && (
              <div className="empty-state">今天没有待办，保持轻松。</div>
            )}
            {pendingTodos.map(todo => (
              <label className="focus-item" key={todo.id}>
                <input type="checkbox" checked={todo.done} onChange={() => props.onToggleTodo(todo.id)} />
                <span>{todo.text}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
