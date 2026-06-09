import { useState } from 'react';
import API_BASE_URL from './config';

function History({ student, sessions, dataLoading }) {
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const getSessionReport = (session) => {
    const report = parseFeedbackReport(session?.feedback);
    if (!report?.metrics?.length) return null;
    return {
      ...report,
      metrics: report.metrics.filter(metric => ['Grammar', 'Accuracy'].includes(metric.name))
    };
  };

  const getMetricByName = (session, name) => getSessionReport(session)?.metrics.find(metric => metric.name === name);

  // Sort sessions newest-first from the shared prop
  const sortedSessions = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleExport = () => {
    window.open(`${API_BASE_URL}/export`, '_blank');
  };

  const parseFeedbackReport = (feedback) => {
    if (!feedback) return null;
    if (typeof feedback === 'object') return feedback;
    try {
      return JSON.parse(feedback);
    } catch {
      return null;
    }
  };

  const metricColors = {
    Grammar: '#10b981',
    Accuracy: '#8b5cf6'
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
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginRight: msg.role === 'user' ? '0.5rem' : '0', marginLeft: msg.role === 'ai' ? '0.5rem' : '0' }}>
                    {msg.role === 'user' ? 'You' : 'AI Partner'}
                  </div>
                  <div style={{ padding: '12px 18px', borderRadius: '18px', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '85%', backgroundColor: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9', color: msg.role === 'user' ? 'white' : 'var(--text-main)', borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px', borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '18px', boxShadow: msg.role === 'user' ? '0 4px 12px rgba(158, 40, 145, 0.2)' : 'none' }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: 'white', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '2rem', textAlign: 'center', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Assessment Report</h3>
            {(() => {
              const report = getSessionReport(selectedSession);
              const metric = selectedMetric ? getMetricByName(selectedSession, selectedMetric) : null;

              if (metric) {
                return (
                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    <button
                      onClick={() => setSelectedMetric(null)}
                      style={{ alignSelf: 'start', padding: '0.75rem 1rem', borderRadius: '999px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '700' }}
                    >
                      ← Back to assessment
                    </button>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                        <span>{metric.name} Details</span>
                        <span>{metric.percent}%</span>
                      </div>
                      <div style={{ height: '10px', background: '#ffffff', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${metric.percent}%`, background: metricColors[metric.name] || 'var(--primary)' }} />
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        <div style={{ marginBottom: '0.75rem' }}><strong>Total answers:</strong> {metric.totalQuestions}</div>
                        <div style={{ marginBottom: '0.75rem' }}><strong>Score earned:</strong> {metric.correct}</div>
                        <div><strong>Score missed:</strong> {metric.missing}</div>
                      </div>
                      <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc' }}>
                        <h4 style={{ marginBottom: '0.75rem', fontWeight: '700' }}>Review</h4>
                        {metric.review?.length ? metric.review.map((item, idx) => (
                          <div key={`${metric.name}-${idx}`} style={{ marginBottom: '0.85rem' }}>
                            <div style={{ fontWeight: 700 }}>{item.answer || `Answer ${idx + 1}`}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
                              {item.status === 'correct'
                                ? 'Strong answer'
                                : item.status === 'partial'
                                  ? item.issue || 'Partly correct'
                                  : item.issue || 'Needs improvement'}
                              {(item.status !== 'correct' && item.suggestion)
                                ? ` Suggestion: ${item.suggestion}`
                                : ''}
                            </div>
                          </div>
                        )) : <div style={{ color: 'var(--text-muted)' }}>No detailed review available for this metric.</div>}
                      </div>
                      <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700 }}>Quick Tip:</span>
                        <span>{metric.quickTip || 'Keep speaking clearly and directly.'}</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (report?.metrics?.length) {
                return (
                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {report.metrics.map(metric => (
                      <button
                        key={metric.name}
                        onClick={() => setSelectedMetric(metric.name)}
                        style={{
                          textAlign: 'left',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px',
                          padding: '1rem',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '0.75rem' }}>
                          <span>{metric.name}</span>
                          <span>{metric.percent}%</span>
                        </div>
                        <div style={{ height: '10px', background: '#ffffff', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                          <div style={{ height: '100%', width: `${metric.percent}%`, background: metricColors[metric.name] || 'var(--primary)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <span>{metric.correct} earned</span>
                          <span>{metric.missing} missed</span>
                          <span>{metric.totalQuestions} answers</span>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              }

              const cleanFeedback = (selectedSession.feedback || "")
                .replace(/#{1,6}\s?/g, '')
                .replace(/>{1,2}\s?/g, '')
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .trim();

              return (
                <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '0.95rem', lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-wrap' }}>
                  {cleanFeedback || 'No feedback was saved for this session.'}
                </div>
              );
            })()}
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

      {dataLoading ? (
        <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading sessions...</p>
      ) : sortedSessions.length === 0 ? (
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
              {sortedSessions.map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{new Date(session.timestamp).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div className="badge badge-accent">{session.conversation?.length || 0} Exchanged</div>
                  </td>
                  <td style={{ padding: '1.25rem' }}>
                    <div className="badge badge-primary">{session.cefrLevel || student.cefrLevel}</div>
                  </td>
                  <td style={{ padding: '1.25rem', textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedSession(session);
                        setSelectedMetric(null);
                      }}
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
