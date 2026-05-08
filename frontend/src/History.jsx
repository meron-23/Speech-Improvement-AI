import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';

function History({ student, onBack }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions?studentId=${student.studentId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to fetch sessions");
      
      // Sort by timestamp descending
      const sorted = (data.sessions || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setSessions(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.open(`${API_BASE_URL}/export`, '_blank');
  };

  if (selectedSession) {
    return (
      <div style={{ width: '100%' }}>
        <div className="section-header">
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Session Analysis</h2>
            <p style={{ color: 'var(--text-muted)' }}>Review your performance from {new Date(selectedSession.timestamp).toLocaleDateString()}.</p>
          </div>
          <button className="nav-item" onClick={() => setSelectedSession(null)} style={{ width: 'auto', background: '#f1f5f9', color: 'var(--text-main)' }}>
            Back to History
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="card" style={{ background: 'white' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem' }}>Full Conversation</h3>
            <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '1rem' }}>
              {selectedSession.conversation && selectedSession.conversation.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: '1.5rem' }}>
                   <div style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: msg.role === 'user' ? 'var(--primary)' : 'var(--accent)', marginBottom: '0.25rem' }}>
                     {msg.role === 'user' ? 'You' : 'AI Partner'}
                   </div>
                   <div style={{ fontSize: '1rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                     {msg.text}
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: 'linear-gradient(135deg, #fff 0%, #fffbf2 100%)', border: '1px solid rgba(229, 169, 53, 0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--accent)' }}>AI Feedback</h3>
            <div style={{ fontSize: '1.05rem', lineHeight: '1.7', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
              {selectedSession.feedback}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Practice History</h2>
          <p style={{ color: 'var(--text-muted)' }}>Track your progress and review past improvements.</p>
        </div>
        <button onClick={handleExport} style={{ background: '#10b981', fontSize: '0.9rem' }}>
          Export History (.CSV)
        </button>
      </div>

      {loading ? (
        <p>Loading sessions...</p>
      ) : error ? (
        <p className="error-text">{error}</p>
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>You haven't completed any sessions yet.</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700' }}>DATE & TIME</th>
                <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700' }}>MESSAGES</th>
                <th style={{ padding: '1.25rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700' }}>LEVEL</th>
                <th style={{ padding: '1.25rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{new Date(session.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(session.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div className="badge badge-accent">{session.conversation?.length || 0} Exchanged</div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div className="badge badge-primary">{session.cefrLevel || student.cefrLevel}</div>
                  </td>
                  <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => setSelectedSession(session)}
                      className="nav-item" 
                      style={{ width: 'auto', display: 'inline-flex', padding: '8px 16px', background: 'rgba(158, 40, 145, 0.05)', color: 'var(--primary)', fontSize: '0.85rem' }}
                    >
                      Review Session
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default History;
