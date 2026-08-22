import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Campus from './pages/Campus';
import Placeholder from './pages/Placeholder';
import './App.css';

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  function renderPage() {
    if (activePage === 'dashboard') return <Dashboard onNavigate={setActivePage} />;
    if (activePage === 'campus') return <Campus />;
    return <Placeholder page={activePage} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <div
        className="main-area"
        style={{
          marginLeft: sidebarCollapsed
            ? 'var(--sidebar-w-col)'
            : 'var(--sidebar-w)',
        }}
      >
        <Header activePage={activePage} />
        <main className="page-content" id="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}