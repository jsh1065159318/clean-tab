import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { MdArrowBack, MdFavorite, MdFavoriteBorder, MdSearch } from 'react-icons/md'
import { toolCategories, tools } from './toolDefinitions'
import type { ToolCategoryId } from './toolDefinitions'

const ToolWorkspace = lazy(() => import('./ToolWorkspace').then(module => ({ default: module.ToolWorkspace })))

interface ToolsViewProps {
  favoriteToolIds: string[]
  onToggleFavorite: (toolId: string) => void
}

export function ToolsView({ favoriteToolIds, onToggleFavorite }: ToolsViewProps) {
  const [category, setCategory] = useState<ToolCategoryId>('all')
  const [filter, setFilter] = useState<'all' | 'favorites'>('all')
  const [query, setQuery] = useState('')
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null)
  const selectedTool = tools.find(tool => tool.id === selectedToolId)
  const visibleTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return tools.filter(tool => {
      const matchesMode = filter === 'all' || favoriteToolIds.includes(tool.id)
      const matchesCategory = category === 'all' || tool.category === category
      const matchesQuery = !normalizedQuery || [tool.name, tool.description, ...tool.keywords]
        .some(value => value.toLowerCase().includes(normalizedQuery))
      return matchesMode && matchesCategory && matchesQuery
    })
  }, [category, favoriteToolIds, filter, query])

  useEffect(() => {
    document.querySelector<HTMLElement>('.newtab-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedToolId])

  if (selectedTool) {
    const Icon = selectedTool.icon
    return (
      <main className="page-view tools-page">
        <button className="tool-back-button" type="button" onClick={() => setSelectedToolId(null)}>
          <MdArrowBack /> 返回工具列表
        </button>
        <section className="page-card tool-workspace-card">
          <div className="tool-workspace-heading">
            <span><Icon /></span>
            <div>
              <p className="section-kicker">本地工具</p>
              <h1>{selectedTool.name}</h1>
              <p>{selectedTool.description}</p>
            </div>
            <button
              className={`tool-favorite-button detail ${favoriteToolIds.includes(selectedTool.id) ? 'is-favorite' : ''}`}
              type="button"
              onClick={() => onToggleFavorite(selectedTool.id)}
              aria-label={favoriteToolIds.includes(selectedTool.id) ? '取消收藏' : '收藏工具'}
            >
              {favoriteToolIds.includes(selectedTool.id) ? <MdFavorite /> : <MdFavoriteBorder />}
            </button>
          </div>
          <Suspense fallback={<div className="view-loading compact" role="status">正在加载工具...</div>}>
            <ToolWorkspace toolId={selectedTool.id} />
          </Suspense>
        </section>
      </main>
    )
  }

  return (
    <main className="page-view tools-page">
      <div className="page-heading tools-page-heading">
        <div>
          <p className="section-kicker">即开即用</p>
          <h1>工具</h1>
          <p>精选 20 个大众常用工具，所有数据都在浏览器本地处理。</p>
        </div>
      </div>

      <div className="tools-toolbar">
        <label className="tools-search">
          <MdSearch />
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索工具" aria-label="搜索工具" />
        </label>
        <div className="segmented-control tool-filter" aria-label="工具范围">
          <button className={filter === 'all' ? 'is-active' : ''} type="button" onClick={() => setFilter('all')}>全部</button>
          <button className={filter === 'favorites' ? 'is-active' : ''} type="button" onClick={() => setFilter('favorites')}>喜欢</button>
        </div>
        {filter === 'all' && (
          <div className="tool-category-tabs" role="tablist" aria-label="工具分类">
            {toolCategories.map(item => (
              <button
                className={category === item.id ? 'is-active' : ''}
                key={item.id}
                type="button"
                role="tab"
                aria-selected={category === item.id}
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <section className="tool-card-grid" aria-label="工具列表">
        {visibleTools.map(tool => {
          const Icon = tool.icon
          return (
            <article className="utility-card" key={tool.id}>
              <button className="utility-card-open" type="button" onClick={() => setSelectedToolId(tool.id)}>
                <span className={`utility-card-icon category-${tool.category}`}><Icon /></span>
                <strong>{tool.name}</strong>
                <p>{tool.description}</p>
              </button>
              <button
                className={`tool-favorite-button ${favoriteToolIds.includes(tool.id) ? 'is-favorite' : ''}`}
                type="button"
                onClick={() => onToggleFavorite(tool.id)}
                aria-label={favoriteToolIds.includes(tool.id) ? `取消收藏 ${tool.name}` : `收藏 ${tool.name}`}
              >
                {favoriteToolIds.includes(tool.id) ? <MdFavorite /> : <MdFavoriteBorder />}
              </button>
            </article>
          )
        })}
        {visibleTools.length === 0 && (
          <div className="empty-state large tool-empty">
            {filter === 'favorites' && !query ? '还没有收藏工具，点击工具卡片上的爱心即可添加。' : '没有找到相关工具。'}
          </div>
        )}
      </section>
    </main>
  )
}
