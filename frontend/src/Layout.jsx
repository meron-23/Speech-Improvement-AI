import React from 'react';
import { Home, FileText, BarChart2, Settings, LogOut, ChevronDown, Mic } from 'lucide-react';

function Layout({ student, currentView, setCurrentView, onLogout, children }) {
  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon">
              <span style={{ position: 'relative', top: '-1px' }}>Y</span>
            </div>
            <div className="logo-text">
              <span className="logo-title">Yimaru</span>
              <span className="logo-subtitle">Academy</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => setCurrentView('DASHBOARD')}
          >
            <Home size={20} className="nav-icon" />
            Home
          </button>
          <button 
            className={`nav-item ${currentView === 'SESSION' ? 'active' : ''}`}
            onClick={() => setCurrentView('SESSION')}
          >
            <Mic size={20} className="nav-icon" />
            Practice
          </button>
          <button 
            className={`nav-item ${currentView === 'HISTORY' ? 'active' : ''}`}
            onClick={() => setCurrentView('HISTORY')}
          >
            <FileText size={20} className="nav-icon" />
            Sessions
          </button>
          <button 
            className={`nav-item ${currentView === 'PROGRESS' ? 'active' : ''}`}
            onClick={() => setCurrentView('PROGRESS')}
          >
            <BarChart2 size={20} className="nav-icon" />
            Progress
          </button>

          <button 
            className={`nav-item ${currentView === 'SETTINGS' ? 'active' : ''}`}
            onClick={() => setCurrentView('SETTINGS')}
          >
            <Settings size={20} className="nav-icon" />
            Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-bottom">
            <img src="/alice_avatar.png" alt="User Avatar" className="user-avatar" />
            <div className="user-info-bottom">
              <span className="user-name-bottom">{student.name}</span>
              <span className="user-level-bottom">{student.cefrLevel} Level</span>
            </div>
            <ChevronDown size={16} className="user-chevron" />
          </div>
          <button className="nav-item logout-btn" onClick={onLogout}>
            <LogOut size={20} className="nav-icon" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;
