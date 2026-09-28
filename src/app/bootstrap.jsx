import { createRoot } from 'react-dom/client';
import App from './WorkspaceApp';
import { AppErrorBoundary } from './AppErrorBoundary';
import '../styles/index.scss';

const root = document.getElementById('root');

if (!root) throw new Error('Application root element is missing.');

createRoot(root).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
