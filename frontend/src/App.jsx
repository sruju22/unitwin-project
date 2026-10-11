import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import Dashboard from './pages/Dashboard';
import Campus from './pages/Campus';
import Placeholder from './pages/Placeholder';
import { getAlerts } from './api/client';
import './App.css';

export default function App() {
  const [activePage, setActivePage] = useState(() => {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    if (['dashboard', 'campus', 'analytics', 'occupancy', 'energy', 'congestion', 'maintenance', 'alerts'].includes(hash)) {
      return hash;
    }
    return 'dashboard';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  // Fetch verified critical alerts count for badge display
  useEffect(() => {
    let isMounted = true;
    async function loadAlertsCount() {
      try {
        const res = await getAlerts({ prototype: false });
        if (isMounted && res && Array.isArray(res.data)) {
          const validCritical = res.data.filter((a) => {
            if (!a || typeof a !== 'object' || a.prototype === true) return false;
            const sev = String(a.severity || '').toLowerCase();
            return (sev === 'critical' || sev === 'high') && !a.acknowledged;
          });
          setAlertCount(validCritical.length);
        }
      } catch {
        if (isMounted) setAlertCount(0);
      }
    }
    loadAlertsCount();
    return () => {
      isMounted = false;
    };
  }, []);

  // Global ⌘K / Ctrl+K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (page) => {
    setActivePage(page);
    window.location.hash = page;
  };

  function renderPage() {
    if (activePage === 'dashboard') return <Dashboard onNavigate={handleNavigate} />;
    if (activePage === 'campus') return <Campus />;
    return <Placeholder page={activePage} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        alertCount={alertCount}
      />

      <div
        className="main-area"
        style={{
          marginLeft: sidebarCollapsed
            ? 'var(--sidebar-w-col)'
            : 'var(--sidebar-w)',
        }}
      >
        <Header
          activePage={activePage}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          alertCount={alertCount}
        />
        <main className="page-content" id="main-content">
          {renderPage()}
        </main>
      </div>

      {/* Global ⌘K Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectPage={handleNavigate}
      />
    </div>
  );
}