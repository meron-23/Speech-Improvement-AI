import React from 'react';

function Layout({ student, currentView, setCurrentView, onLogout, children }) {
  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Speech AI</h2>
          <div className="user-card">
            <span className="user-name">{student.name}</span>
            <span className="user-level">{student.cefrLevel} Level</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'DASHBOARD' ? 'active' : ''}`}
            onClick={() => setCurrentView('DASHBOARD')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-item ${currentView === 'SESSION' ? 'active' : ''}`}
            onClick={() => setCurrentView('SESSION')}
          >
            Practice Session
          </button>
          <button 
            className={`nav-item ${currentView === 'HISTORY' ? 'active' : ''}`}
            onClick={() => setCurrentView('HISTORY')}
          >
            Session History
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={onLogout}>
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
