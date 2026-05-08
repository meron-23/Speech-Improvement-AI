import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';

function Dashboard({ student, onNewSession, onViewHistory }) {
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentSessions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sessions?studentId=${student.studentId}`);
        if (res.ok) {
          const data = await res.json();
          // Sort by timestamp descending and take up to 5
          const sorted = (data.sessions || [])
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);
          setRecentSessions(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch recent sessions", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentSessions();
  }, [student.studentId]);

  return (
    <div style={{ width: '100%' }}>
      <div className="section-header" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', fontWeight: '800' }}>Welcome back, {student.name}!</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Ready to master your English speaking today?</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Sessions</span>
          <span className="stat-value">{recentSessions.length > 0 ? recentSessions.length + "+" : "0"}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">CEFR Level</span>
          <span className="stat-value" style={{ color: 'var(--primary)' }}>{student.cefrLevel}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Practice Streak</span>
          <span className="stat-value">3 Days</span>
        </div>
      </div>

      <div className="card" style={{ padding: '2.5rem', marginBottom: '3rem', background: 'linear-gradient(135deg, var(--primary) 0%, #7c1e72 100%)', border: 'none', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'white' }}>
          <h3 style={{ color: 'white', background: 'none', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Start a New Session</h3>
          <p style={{ opacity: '0.9', marginBottom: '0' }}>Have a 10-minute conversation with your AI partner.</p>
        </div>
        <button onClick={onNewSession} style={{ background: 'white', color: 'var(--primary)', padding: '1rem 2rem' }}>
          Launch AI Partner
        </button>
      </div>

      <div>
        <div className="section-header">
          <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Recent Activity</h3>
          <button onClick={onViewHistory} className="nav-item" style={{ width: 'auto', padding: '8px 16px', fontSize: '0.9rem' }}>
            View Full History
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading recent sessions...</p>
        ) : recentSessions.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem', border: '2px dashed rgba(0,0,0,0.05)', boxShadow: 'none', background: 'transparent' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No recent sessions found. Start your first session above!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {recentSessions.map((session) => (
              <div key={session.id} className="stat-card" style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div className="badge badge-primary">
                    {new Date(session.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(session.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  Conversation Session
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {session.conversation?.length || 0} messages • Click to review
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
