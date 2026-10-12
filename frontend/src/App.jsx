import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import Dashboard from './pages/Dashboard';
import Campus from './pages/Campus';
import Analytics from './pages/Analytics';
import Occupancy from './pages/Occupancy';
import Congestion from './pages/Congestion';
import Maintenance from './pages/Maintenance';
import Alerts from './pages/Alerts';
import Energy from './pages/Energy';
import Placeholder from './pages/Placeholder';
import FloatingAiChat from './components/FloatingAiChat/FloatingAiChat';
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

  // Fetch verified critical alerts count for badge display from MongoDB
  useEffect(() => {
    let isMounted = true;
    async function loadAlertsCount() {
      try {
        const res = await getAlerts();
        if (isMounted && res && Array.isArray(res.data)) {
          const validCritical = res.data.filter((a) => {
            if (!a || typeof a !== 'object') return false;
            const sev = String(a.severity || '').toLowerCase();
            const stat = String(a.status || 'Active').toLowerCase();
            return (sev === 'critical' || sev === 'high') && stat !== 'resolved' && !a.acknowledged;
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

  // Listen to browser hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const raw = window.location.hash.replace('#', '').split('?')[0].toLowerCase();
      if (['dashboard', 'campus', 'analytics', 'occupancy', 'energy', 'congestion', 'maintenance', 'alerts'].includes(raw)) {
        setActivePage(raw);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page, params = {}) => {
    setActivePage(page);
    if (params && params.type) {
      sessionStorage.setItem('unitwin_alerts_filter_type', params.type);
      window.location.hash = `${page}?type=${encodeURIComponent(params.type)}`;
    } else {
      window.location.hash = page;
    }
  };

  function renderPage() {
    if (activePage === 'dashboard') return <Dashboard onNavigate={handleNavigate} />;
    if (activePage === 'campus') return <Campus />;
    if (activePage === 'analytics') return <Analytics onNavigate={handleNavigate} />;
    if (activePage === 'occupancy') return <Occupancy />;
    if (activePage === 'energy') return <Energy onNavigate={handleNavigate} />;
    if (activePage === 'congestion') return <Congestion />;
    if (activePage === 'maintenance') return <Maintenance />;
    if (activePage === 'alerts') return <Alerts />;
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

      {/* Floating AI Assistant - Strictly excluded on interactive Campus page */}
      {activePage !== 'campus' && (
        <FloatingAiChat
          activePage={activePage}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}