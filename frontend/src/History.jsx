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
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem' }}>Session Analysis</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Review your performance from {new Date(selectedSession.timestamp).toLocaleDateString()}.</p>
          </div>
          <button className="nav-item" onClick={() => setSelectedSession(null)} style={{ width: 'auto', background: '#f1f5f9', color: 'var(--text-main)', padding: '10px 24px' }}>
            Back to History
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          <div className="card" style={{ background: 'white', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Full Conversation</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedSession.conversation && selectedSession.conversation.map((msg, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}>
                   <div style={{ 
                     fontSize: '0.7rem', 
                     fontWeight: '800', 
                     textTransform: 'uppercase', 
                     color: 'var(--text-muted)', 
                     marginBottom: '0.25rem',
                     marginRight: msg.role === 'user' ? '0.5rem' : '0',
                     marginLeft: msg.role === 'ai' ? '0.5rem' : '0'
                   }}>
                     {msg.role === 'user' ? 'You' : 'AI Partner'}
                   </div>
                   <div style={{ 
                     padding: '12px 18px',
                     borderRadius: '18px',
                     fontSize: '0.95rem',
                     lineHeight: '1.5',
                     maxWidth: '85%',
                     backgroundColor: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9',
                     color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                     borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px',
                     borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '18px',
                     boxShadow: msg.role === 'user' ? '0 4px 12px rgba(158, 40, 145, 0.2)' : 'none'
                   }}>
                     {msg.text}
                   </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: 'white', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>AI Mission Report</h3>
            <div className="feedback-grid" style={{ 
              display: 'grid', 
              gap: '1.25rem',
            }}>
              {(() => {
                const cleanFeedback = (selectedSession.feedback || "")
                  .replace(/#{1,6}\s?/g, '') // Remove ### headers
                  .replace(/>{1,2}\s?/g, '') // Remove >> blockquotes
                  .replace(/\*\*/g, '')      // Remove ** bold
                  .replace(/\*/g, '')        // Remove * bullets
                  .trim();

                let sections = cleanFeedback.split(/(?=🌟|🛠️|🔥)/);
                if (sections.length <= 1 && cleanFeedback.includes('\n\n')) {
                  sections = cleanFeedback.split('\n\n');
                }

                return sections.map((section, idx) => {
                  if (!section.trim()) return null;
                  const isStrength = section.includes('🌟') || idx === 0;
                  const isFix = section.includes('🛠️') || idx === 1;
                  const isChallenge = section.includes('🔥') || idx >= 2;
                  
                  let bgColor = '#f8fafc';
                  let borderColor = '#e2e8f0';
                  let iconColor = '#64748b';
                  
                  if (isStrength) { bgColor = '#f0fdf4'; borderColor = '#bbf7d0'; iconColor = '#16a34a'; }
                  if (isFix) { bgColor = '#fffbeb'; borderColor = '#fef3c7'; iconColor = '#d97706'; }
                  if (isChallenge) { bgColor = '#eff6ff'; borderColor = '#dbeafe'; iconColor = '#2563eb'; }

                  const title = section.includes(':') ? section.split(':')[0] : (isStrength ? '🌟 Strengths' : (isFix ? '🛠️ Quick Fixes' : '🔥 Next Mission'));
                  const content = section.includes(':') ? section.split(':').slice(1).join(':').trim() : section.trim();

                  return (
                    <div key={idx} style={{ 
                      backgroundColor: bgColor, 
                      padding: '1.25rem', 
                      borderRadius: '16px', 
                      border: `1px solid ${borderColor}`,
                      fontSize: '0.95rem',
                      lineHeight: '1.6'
                    }}>
                      <div style={{ fontWeight: '800', color: iconColor, marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {title}
                      </div>
                      <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {content}
                      </div>
                    </div>
                  );
                });
              })()}
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
