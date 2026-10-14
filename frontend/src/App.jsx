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

  // Central dashboard reporting date context (Default: Wednesday, October 14, 2026)
  const [reportingDate, setReportingDate] = useState(() => {
    try {
      const stored = sessionStorage.getItem('unitwin_reporting_date');
      if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;
      const urlParams = new URLSearchParams(window.location.search);
      const qDate = urlParams.get('date');
      if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) return qDate;
    } catch {
      // ignore
    }
    return '2026-10-14';
  });

  const handleSelectDate = (newDate) => {
    if (!newDate || typeof newDate !== 'string') return;
    setReportingDate(newDate);
    try {
      sessionStorage.setItem('unitwin_reporting_date', newDate);
    } catch {
      // ignore
    }
  };

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
    } else if (params && params.buildingId) {
      sessionStorage.setItem('unitwin_campus_selected_building', params.buildingId);
      window.location.hash = `${page}?building=${encodeURIComponent(params.buildingId)}`;
    } else if (params && params.search) {
      sessionStorage.setItem('unitwin_global_search_term', params.search);
      window.location.hash = `${page}?q=${encodeURIComponent(params.search)}`;
    } else {
      window.location.hash = page;
    }
  };

  function renderPage() {
    if (activePage === 'dashboard') {
      return (
        <Dashboard
          onNavigate={handleNavigate}
          reportingDate={reportingDate}
          onSelectDate={handleSelectDate}
        />
      );
    }
    if (activePage === 'campus') return <Campus />;
    if (activePage === 'analytics') return <Analytics onNavigate={handleNavigate} reportingDate={reportingDate} onSelectDate={handleSelectDate} />;
    if (activePage === 'occupancy') return <Occupancy reportingDate={reportingDate} onSelectDate={handleSelectDate} />;
    if (activePage === 'energy') {
      return (
        <Energy
          onNavigate={handleNavigate}
          reportingDate={reportingDate}
          onSelectDate={handleSelectDate}
        />
      );
    }
    if (activePage === 'congestion') return <Congestion />;
    if (activePage === 'maintenance') return <Maintenance />;
    if (activePage === 'alerts') return <Alerts />;
    return <Placeholder page={activePage} />;
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        alertCount={alertCount}
      />

      <div className={`main-area ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          activePage={activePage}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          alertCount={alertCount}
          reportingDate={reportingDate}
          onSelectDate={handleSelectDate}
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
          reportingDate={reportingDate}
        />
      )}
    </div>
  );
}