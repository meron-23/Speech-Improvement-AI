import { useState } from 'react';
import { AM, EN } from './Layout';
import API_BASE_URL from './config';

function History({ student, sessions, lessons = [], dataLoading, amharic }) {
  const T = amharic ? AM : EN;
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  const metricColors = { Grammar: '#10b981', Accuracy: '#8b5cf6' };

  const parseFeedbackReport = (feedback) => {
    if (!feedback) return null;
    if (typeof feedback === 'object') return feedback;
    try { return JSON.parse(feedback); } catch { return null; }
  };

  const getSessionReport = (session) => {
    const report = parseFeedbackReport(session?.feedback);
    if (!report?.metrics?.length) return null;
    return { ...report, metrics: report.metrics.filter(m => ['Grammar', 'Accuracy'].includes(m.name)) };
  };

  const getOverallScore = (session) => {
    const report = getSessionReport(session);
    if (!report?.metrics?.length) return null;
    const mean = report.metrics.reduce((sum, m) => sum + (m.percent || 0), 0) / report.metrics.length;
    return Math.round(mean);
  };

  const getMetricByName = (session, name) =>
    getSessionReport(session)?.metrics.find(m => m.name === name);

  const getLessonTitle = (lessonId) => {
    if (!lessonId) return T.generalPractice;
    const lesson = lessons.find(l => l.lessonId === lessonId);
    return lesson?.title || lessonId;
  };

  // Group sessions by lessonId, sorted newest first within each group
  const groupSessions = () => {
    const groups = {};
    const sorted = [...sessions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    sorted.forEach(s => {
      const key = s.lessonId || '__general__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  };

  const toggleGroup = (key) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const handleExport = () => window.open(`${API_BASE_URL}/export`, '_blank');

  // ── DETAIL VIEW ──────────────────────────────────────────────────────────────
  if (selectedSession) {
    const report = getSessionReport(selectedSession);
    const metric = selectedMetric ? getMetricByName(selectedSession, selectedMetric) : null;
    const overallScore = getOverallScore(selectedSession);

    return (
      <div style={{ width: '100%' }}>
        <div className="section-header">
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>
              {T.sessions}
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>
              {new Date(selectedSession.timestamp).toLocaleDateString()} ·{' '}
              {getLessonTitle(selectedSession.lessonId)}
            </p>
          </div>
          <button className="nav-item" onClick={() => { setSelectedSession(null); setSelectedMetric(null); }}
            style={{ width: 'auto', background: '#f1f5f9', color: 'var(--text-main)', padding: '10px 24px' }}>
            {T.backToHistory}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
          {/* Conversation */}
          <div className="card" style={{ background: 'white', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Conversation
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(selectedSession.conversation || []).map((msg, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginRight: msg.role === 'user' ? '0.5rem' : 0, marginLeft: msg.role === 'ai' ? '0.5rem' : 0 }}>
                    {msg.role === 'user' ? 'You' : 'AI Partner'}
                  </div>
                  <div style={{ padding: '12px 18px', borderRadius: '18px', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '85%', backgroundColor: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9', color: msg.role === 'user' ? 'white' : 'var(--text-main)', borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px', borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '18px', boxShadow: msg.role === 'user' ? '0 4px 12px rgba(158,40,145,0.2)' : 'none' }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessment */}
          <div className="card" style={{ background: 'white', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {T.overallScore}
            </h3>

            {/* Overall score banner */}
            {overallScore !== null && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderRadius: '14px', background: overallScore >= 60 ? '#ecfdf5' : '#fef2f2', border: `1px solid ${overallScore >= 60 ? '#10b981' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '700', color: overallScore >= 60 ? '#065f46' : '#991b1b' }}>
                  {overallScore >= 60 ? T.passed : T.notYet}
                </span>
                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: overallScore >= 60 ? '#10b981' : '#ef4444' }}>
                  {overallScore}%
                </span>
              </div>
            )}

            {metric ? (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                <button onClick={() => setSelectedMetric(null)} style={{ alignSelf: 'start', padding: '0.75rem 1rem', borderRadius: '999px', border: '1px solid #e2e8f0', background: '#f8fafc', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '700' }}>
                  ← Back to assessment
                </button>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem' }}>
                    <span>{metric.name} Details</span><span>{metric.percent}%</span>
                  </div>
                  <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${metric.percent}%`, background: metricColors[metric.name] || 'var(--primary)' }} />
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                    <div style={{ marginBottom: '0.5rem' }}><strong>Total answers:</strong> {metric.totalQuestions}</div>
                    <div style={{ marginBottom: '0.5rem' }}><strong>Score earned:</strong> {metric.correct}</div>
                    <div><strong>Score missed:</strong> {metric.missing}</div>
                  </div>
                  <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc' }}>
                    <h4 style={{ marginBottom: '0.75rem', fontWeight: '700' }}>Review</h4>
                    {metric.review?.length ? metric.review.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: '0.85rem' }}>
                        <div style={{ fontWeight: 700 }}>{item.answer || `Answer ${idx + 1}`}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginTop: '0.25rem' }}>
                          {item.status === 'correct' ? 'Strong answer' : item.status === 'partial' ? item.issue || 'Partly correct' : item.issue || 'Needs improvement'}
                          {item.status !== 'correct' && item.suggestion ? ` — ${item.suggestion}` : ''}
                        </div>
                      </div>
                    )) : <div style={{ color: 'var(--text-muted)' }}>No detailed review available.</div>}
                  </div>
                  <div style={{ padding: '1rem', borderRadius: '16px', background: '#f8fafc', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>Quick Tip:</span>
                    <span>{metric.quickTip || 'Keep speaking clearly and directly.'}</span>
                  </div>
                </div>
              </div>
            ) : report?.metrics?.length ? (
              <div style={{ display: 'grid', gap: '1.25rem' }}>
                {report.metrics.map(m => (
                  <button key={m.name} onClick={() => setSelectedMetric(m.name)} style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1rem', cursor: 'pointer', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, marginBottom: '0.75rem' }}>
                      <span>{m.name}</span><span>{m.percent}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#ffffff', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                      <div style={{ height: '100%', width: `${m.percent}%`, background: metricColors[m.name] || 'var(--primary)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <span>{m.correct} earned</span><span>{m.missing} missed</span><span>{m.totalQuestions} answers</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', fontSize: '0.95rem', lineHeight: '1.6', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {((selectedSession.feedback || '').replace(/#{1,6}\s?/g, '').replace(/>+\s?/g, '').replace(/\*\*/g, '').replace(/\*/g, '').trim()) || 'No feedback saved for this session.'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW (grouped by lesson) ─────────────────────────────────────────────
  const grouped = groupSessions();
  const groupKeys = Object.keys(grouped);

  return (
    <div style={{ width: '100%' }}>
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>{T.sessions}</h2>
          <p style={{ color: 'var(--text-muted)' }}>
            {amharic ? 'ያለፉ ክፍለ ጊዜዎች በትምህርት ደረጃ' : 'Past sessions organized by lesson'}
          </p>
        </div>
        <button onClick={handleExport} style={{ background: '#10b981', fontSize: '0.9rem' }}>
          Export (.CSV)
        </button>
      </div>

      {dataLoading ? (
        <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>
          {amharic ? 'ክፍለ ጊዜዎች እየጫኑ ነው…' : 'Loading sessions…'}
        </p>
      ) : groupKeys.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{T.noSessions}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {groupKeys.map(key => {
            const groupSessions = grouped[key];
            const title = getLessonTitle(key === '__general__' ? null : key);
            const isOpen = expandedGroups[key] !== false; // default open
            const passCount = groupSessions.filter(s => s.passed).length;

            return (
              <div key={key} style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.05)' }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(key)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)' }}>{title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {groupSessions.length} {amharic ? 'ክፍለ ጊዜ' : 'session(s)'} · {passCount} {amharic ? 'ያለፉ' : 'passed'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '4px 10px', borderRadius: '999px', background: passCount > 0 ? '#ecfdf5' : '#f8fafc', color: passCount > 0 ? '#10b981' : '#94a3b8', fontSize: '0.8rem', fontWeight: '700' }}>
                      {passCount}/{groupSessions.length} ✓
                    </div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                      ▾
                    </span>
                  </div>
                </button>

                {/* Session rows */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    {groupSessions.map((session, idx) => {
                      const overallScore = getOverallScore(session);
                      return (
                        <div key={session.id || idx} style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: idx < groupSessions.length - 1 ? '1px solid #f8fafc' : 'none', gap: '1rem' }}>
                          {/* Pass/fail dot */}
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: session.passed ? '#10b981' : '#e2e8f0' }} />

                          {/* Date */}
                          <div style={{ minWidth: '100px' }}>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                              {new Date(session.timestamp).toLocaleDateString()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>

                          {/* Stats */}
                          <div style={{ flex: 1, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <span className="badge badge-accent">{session.conversation?.length || 0} {amharic ? 'ልውውጥ' : 'turns'}</span>
                            <span className="badge badge-primary">{session.cefrLevel || student.cefrLevel}</span>
                            {overallScore !== null && (
                              <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '800', background: overallScore >= 60 ? '#ecfdf5' : '#fef2f2', color: overallScore >= 60 ? '#10b981' : '#ef4444' }}>
                                {T.overallScore}: {overallScore}%
                              </span>
                            )}
                          </div>

                          {/* Review button */}
                          <button
                            onClick={() => { setSelectedSession(session); setSelectedMetric(null); }}
                            className="nav-item"
                            style={{ width: 'auto', display: 'inline-flex', padding: '8px 16px', background: 'rgba(158,40,145,0.05)', color: 'var(--primary)', fontSize: '0.85rem', flexShrink: 0 }}
                          >
                            {T.reviewSession}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default History;
