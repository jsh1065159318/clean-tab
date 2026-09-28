import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { MdDownload, MdRefresh } from 'react-icons/md'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  exportFailed: boolean
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { exportFailed: false, hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { exportFailed: false, hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Clean Tab failed to render:', error, info)
  }

  exportLocalData = () => {
    try {
      const data = Object.fromEntries(
        Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
          .filter((key): key is string => Boolean(key))
          .map(key => [key, window.localStorage.getItem(key)]),
      )
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2)], {
        type: 'application/json',
      })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `clean-tab-recovery-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(href)
    } catch (error) {
      console.error('Failed to export local recovery data:', error)
      this.setState({ exportFailed: true })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="fatal-error" role="alert">
        <div className="fatal-error__content">
          <p>清爽标签页</p>
          <h1>页面暂时无法加载</h1>
          <span>你的本地数据仍保留在浏览器中。可以先导出恢复文件，再重新加载。</span>
          {this.state.exportFailed && <strong>导出失败，请暂时不要清理浏览器数据。</strong>}
          <div>
            <button type="button" onClick={this.exportLocalData}>
              <MdDownload /> 导出本地数据
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              <MdRefresh /> 重新加载
            </button>
          </div>
        </div>
      </main>
    )
  }
}
