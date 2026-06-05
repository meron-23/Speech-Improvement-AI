import React, { useState, useMemo } from 'react';
import { 
  Trophy, Lock, Play, CheckCircle2,
  MessageSquare, BookOpen, AlertCircle, Loader2, X, Star
} from 'lucide-react';

function Progress({ student, sessions, lessons, dataLoading, onStartLesson }) {
  const [selectedLesson, setSelectedLesson] = useState(null);

  // Compute stats from sessions prop
  const stats = useMemo(() => {
    const total = sessions.length;
    const passed = sessions.filter(s => s.passed).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    let totalWords = 0, totalTurns = 0;
    const uniqueWordsSet = new Set();
    sessions.forEach(session => {
      (session.conversation || []).forEach(msg => {
        if (msg.role === 'user' && msg.text) {
          totalTurns++;
          msg.text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').split(/\s+/).forEach(w => {
            if (w.trim()) { totalWords++; uniqueWordsSet.add(w.trim()); }
          });
        }
      });
    });
    return {
      totalSessions: total, passedSessions: passed, passRate,
      totalWords, uniqueWords: uniqueWordsSet.size,
      avgWordsPerTurn: totalTurns > 0 ? (totalWords / totalTurns).toFixed(1) : 0
    };
  }, [sessions]);

  const processedLessons = useMemo(() => {
    const passedIds = new Set(sessions.filter(s => s.passed).map(s => s.lessonId));
    return lessons.map((lesson, idx) => {
      const isCompleted = passedIds.has(lesson.lessonId);
      const isFirst = idx === 0;
      const prevDone = !isFirst && passedIds.has(lessons[idx - 1].lessonId);
      const isUnlocked = isFirst || prevDone || isCompleted || student.currentLesson?.lessonId === lesson.lessonId;
      const isCurrent = student.currentLesson?.lessonId === lesson.lessonId;
      return { ...lesson, isCompleted, isUnlocked, isCurrent };
    });
  }, [sessions, lessons, student.currentLesson]);

  if (dataLoading) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 size={40} className="spin-icon" color="var(--primary)" />
        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Loading Candy Map...</span>
      </div>
    );
  }

  const completedCount = processedLessons.filter(l => l.isCompleted).length;
  const totalCount = processedLessons.length;
  const levelProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Map generation logic (Snake Layout)
  const itemsPerRow = 5;
  const rows = [];
  for (let i = 0; i < processedLessons.length; i += itemsPerRow) {
    rows.push(processedLessons.slice(i, i + itemsPerRow));
  }

  const handleNodeClick = (lesson) => {
    setSelectedLesson(lesson);
  };

  return (
    <div style={{ width: '100%', paddingBottom: '3rem', position: 'relative' }}>
      
      {/* Tab Header */}
      <div className="dashboard-greeting" style={{ marginBottom: '2rem' }}>
        <h2>Level Progress Map 🗺️</h2>
        <p>Complete nodes to unlock the path and master your level!</p>
      </div>

      {/* Analytics Overview Grid */}
      <div className="dashboard-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
        <div className="dashboard-stat-card progress-card" style={{ height: 'auto', display: 'flex', gap: '1.25rem', padding: '1.5rem', alignItems: 'center' }}>
          <div className="cefr-circle" style={{ width: '60px', height: '60px', fontSize: '1.25rem', flexShrink: 0 }}>
            {student.cefrLevel}
          </div>
          <div className="cefr-progress-info" style={{ width: '100%' }}>
            <span className="progress-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Level Completion</span>
              <strong>{levelProgress}%</strong>
            </span>
            <div className="progress-bar-bg" style={{ margin: '8px 0' }}>
              <div className="progress-bar-fill" style={{ width: `${levelProgress}%` }}></div>
            </div>
            <span className="progress-subtext">{completedCount} of {totalCount} missions passed</span>
          </div>
        </div>
        <div className="dashboard-stat-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.5rem', alignItems: 'center' }}>
          <div className="stat-icon-wrapper check" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <MessageSquare size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.avgWordsPerTurn}</span>
            <span className="stat-label">Words / Turn (Fluency)</span>
          </div>
        </div>
        <div className="dashboard-stat-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.5rem', alignItems: 'center' }}>
          <div className="stat-icon-wrapper" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
            <BookOpen size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.uniqueWords}</span>
            <span className="stat-label">Unique Words Spoken</span>
          </div>
        </div>
      </div>

      {/* Candy Crush Style Map */}
      <div className="candy-map-wrapper">
        <div className="candy-map-container">
          {rows.map((rowItems, rowIndex) => {
            const isEven = rowIndex % 2 === 0;
            const items = isEven ? rowItems : [...rowItems].reverse();
            
            return (
              <div key={rowIndex} className={`map-row ${isEven ? 'row-even' : 'row-odd'}`}>
                
                {/* Horizontal connection line for the row */}
                <div className="row-connector-line"></div>
                
                {/* U-Turn connectors between rows */}
                {rowIndex < rows.length - 1 && (
                  <div className={`u-turn-connector ${isEven ? 'right' : 'left'}`}></div>
                )}

                {items.map((lesson) => {
                  const statusClass = lesson.isCompleted ? 'completed' : lesson.isCurrent ? 'current' : lesson.isUnlocked ? 'unlocked' : 'locked';
                  
                  return (
                    <div 
                      key={lesson.lessonId} 
                      className={`map-node-wrapper`}
                      onClick={() => handleNodeClick(lesson)}
                    >
                      <div className={`map-node ${statusClass}`}>
                        <div className="node-inner">
                          {lesson.isCompleted ? (
                            <Star size={24} fill="currentColor" />
                          ) : lesson.isCurrent ? (
                            <Play size={24} fill="currentColor" style={{ marginLeft: '4px' }} />
                          ) : lesson.isUnlocked ? (
                            <span className="node-number">{lesson.order}</span>
                          ) : (
                            <Lock size={20} />
                          )}
                        </div>
                        {/* Tooltip on hover */}
                        <div className="node-tooltip">{lesson.title}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Node Details Modal */}
      {selectedLesson && (
        <div className="map-modal-overlay" onClick={() => setSelectedLesson(null)}>
          <div className="map-modal-content animate-pop-in" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedLesson(null)}>
              <X size={20} />
            </button>

            <div className="modal-header">
              <span className={`modal-status-badge ${selectedLesson.isCompleted ? 'completed' : selectedLesson.isUnlocked ? 'active' : 'locked'}`}>
                {selectedLesson.isCompleted ? 'Completed ⭐' : selectedLesson.isUnlocked ? 'Active Mission 🎯' : 'Locked 🔒'}
              </span>
              <h3>Level {selectedLesson.order}: {selectedLesson.title}</h3>
            </div>
            
            <div className="modal-body">
              <p className="modal-objective">{selectedLesson.objective}</p>
              
              {selectedLesson.targetVocabulary && selectedLesson.targetVocabulary.length > 0 && (
                <div className="modal-vocab-list">
                  {selectedLesson.targetVocabulary.map((vocab, vIdx) => (
                    <span key={vIdx} className="modal-vocab-tag">📖 {vocab}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className={`modal-play-btn ${!selectedLesson.isUnlocked ? 'disabled' : ''}`}
                disabled={!selectedLesson.isUnlocked}
                onClick={() => {
                  if (selectedLesson.isUnlocked) {
                    // Start lesson and close modal
                    onStartLesson(selectedLesson);
                  }
                }}
              >
                {selectedLesson.isCompleted ? (
                  <>Replay Practice <Play size={18} fill="currentColor" /></>
                ) : !selectedLesson.isUnlocked ? (
                  <>Level Locked <Lock size={18} /></>
                ) : (
                  <>Start Mission <Play size={18} fill="currentColor" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Progress;
export { Progress };
