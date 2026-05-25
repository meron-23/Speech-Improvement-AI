import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';
import { 
  Trophy, Lock, Play, CheckCircle2, Award, 
  MessageSquare, BarChart2, BookOpen, AlertCircle, Loader2 
} from 'lucide-react';

function Progress({ student, onStartLesson }) {
  const [lessons, setLessons] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Analytics states calculated from real sessions
  const [stats, setStats] = useState({
    totalSessions: 0,
    passedSessions: 0,
    passRate: 0,
    totalWords: 0,
    uniqueWords: 0,
    avgWordsPerTurn: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch all lessons for the student's CEFR level
        const lessonsRes = await fetch(`${API_BASE_URL}/lessons?level=${student.cefrLevel}`);
        if (!lessonsRes.ok) throw new Error("Failed to fetch curriculum");
        const lessonsData = await lessonsRes.json();
        
        // Sort lessons by order
        const sortedLessons = (lessonsData.lessons || []).sort((a, b) => a.order - b.order);
        setLessons(sortedLessons);

        // 2. Fetch all student sessions
        const sessionsRes = await fetch(`${API_BASE_URL}/sessions?studentId=${student.studentId}`);
        if (!sessionsRes.ok) throw new Error("Failed to fetch sessions data");
        const sessionsData = await sessionsRes.json();
        const userSessions = sessionsData.sessions || [];
        setSessions(userSessions);

        // 3. Compute real stats
        calculateRealStats(userSessions);

      } catch (err) {
        console.error(err);
        setError(err.message || "An error occurred loading progress data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [student.studentId, student.cefrLevel]);

  const calculateRealStats = (sessionList) => {
    const total = sessionList.length;
    const passed = sessionList.filter(s => s.passed).length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    let totalWords = 0;
    let totalTurns = 0;
    const uniqueWordsSet = new Set();

    sessionList.forEach(session => {
      const convo = session.conversation || [];
      convo.forEach(msg => {
        if (msg.role === 'user' && msg.text) {
          totalTurns++;
          // Clean and split text to count words
          const words = msg.text
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
            .split(/\s+/);
          
          words.forEach(word => {
            if (word.trim()) {
              totalWords++;
              uniqueWordsSet.add(word.trim());
            }
          });
        }
      });
    });

    const avgWords = totalTurns > 0 ? (totalWords / totalTurns).toFixed(1) : 0;

    setStats({
      totalSessions: total,
      passedSessions: passed,
      passRate: passRate,
      totalWords: totalWords,
      uniqueWords: uniqueWordsSet.size,
      avgWordsPerTurn: avgWords
    });
  };

  // Determine locking/unlocking logic
  const getLessonsWithStatus = () => {
    // List of lessonIds the user has passed
    const passedLessonIds = new Set(
      sessions.filter(s => s.passed).map(s => s.lessonId)
    );

    return lessons.map((lesson, idx) => {
      const isCompleted = passedLessonIds.has(lesson.lessonId);
      
      // A lesson is unlocked if:
      // - It is the first lesson in the level
      // - The previous lesson in the level has been completed (passed)
      // - The student is currently placed on this lesson (matching backend currentLessonId assignment)
      const isFirst = idx === 0;
      const prevLessonCompleted = !isFirst && passedLessonIds.has(lessons[idx - 1].lessonId);
      
      const isUnlocked = isFirst || prevLessonCompleted || isCompleted || student.currentLesson?.lessonId === lesson.lessonId;

      return {
        ...lesson,
        isCompleted,
        isUnlocked
      };
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 size={40} className="spin-icon" color="var(--primary)" />
        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Analyzing student performance data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: '#dc2626' }}>
        <AlertCircle size={40} />
        <span>{error}</span>
      </div>
    );
  }

  const processedLessons = getLessonsWithStatus();
  // Calculate completion percentage of current CEFR level
  const completedCount = processedLessons.filter(l => l.isCompleted).length;
  const totalCount = processedLessons.length;
  const levelProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      
      {/* Tab Header */}
      <div className="dashboard-greeting" style={{ marginBottom: '2rem' }}>
        <h2>Level Progress & Analytics 📊</h2>
        <p>Real-time statistics of your English speaking performance.</p>
      </div>

      {/* Analytics Overview Grid */}
      <div className="dashboard-stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
        
        {/* Level Progress Circle Card */}
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

        {/* Fluency Card */}
        <div className="dashboard-stat-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.5rem', alignItems: 'center' }}>
          <div className="stat-icon-wrapper check" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <MessageSquare size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.avgWordsPerTurn}</span>
            <span className="stat-label">Words / Turn (Fluency)</span>
          </div>
        </div>

        {/* Vocab Size Card */}
        <div className="dashboard-stat-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.5rem', alignItems: 'center' }}>
          <div className="stat-icon-wrapper" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
            <BookOpen size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.uniqueWords}</span>
            <span className="stat-label">Unique Words Spoken</span>
          </div>
        </div>

        {/* Pass Rate Card */}
        <div className="dashboard-stat-card" style={{ display: 'flex', gap: '1.25rem', padding: '1.5rem', alignItems: 'center' }}>
          <div className="stat-icon-wrapper fire" style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}>
            <Trophy size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.passRate}%</span>
            <span className="stat-label">Mission Pass Rate</span>
          </div>
        </div>
      </div>

      {/* Gamified Levels Path Section */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '2.5rem', color: '#1e293b' }}>
          Level Pathway
        </h3>

        <div className="levels-path-container" style={{ position: 'relative', width: '100%', maxWidth: '650px', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* Vertical Connecting Line */}
          <div style={{
            position: 'absolute',
            left: '30px',
            top: '40px',
            bottom: '40px',
            width: '4px',
            borderLeft: '4px dashed #e2e8f0',
            zIndex: 1
          }}></div>

          {processedLessons.map((lesson, idx) => {
            const isLast = idx === processedLessons.length - 1;
            
            return (
              <div 
                key={lesson.lessonId}
                style={{ 
                  display: 'flex', 
                  gap: '2rem', 
                  alignItems: 'flex-start',
                  position: 'relative',
                  zIndex: 2
                }}
              >
                {/* Node Step Icon */}
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                  backgroundColor: lesson.isCompleted 
                    ? '#d1fae5' // Completed (Green)
                    : lesson.isUnlocked 
                      ? '#f5f3ff' // Active/Unlocked (Light Purple)
                      : '#f1f5f9', // Locked (Gray)
                  color: lesson.isCompleted 
                    ? '#059669' 
                    : lesson.isUnlocked 
                      ? '#8b5cf6' 
                      : '#94a3b8',
                  border: lesson.isUnlocked && !lesson.isCompleted
                    ? '3px solid #8b5cf6'
                    : '3px solid transparent',
                  animation: lesson.isUnlocked && !lesson.isCompleted
                    ? 'pulse-ring 2s infinite'
                    : 'none'
                }}>
                  {lesson.isCompleted ? (
                    <CheckCircle2 size={32} />
                  ) : !lesson.isUnlocked ? (
                    <Lock size={24} />
                  ) : (
                    <Play size={24} style={{ marginLeft: '4px' }} />
                  )}
                </div>

                {/* Level Detail Card */}
                <div style={{
                  flex: 1,
                  backgroundColor: 'white',
                  borderRadius: '20px',
                  padding: '1.5rem',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                  opacity: lesson.isUnlocked ? 1 : 0.65,
                  transition: 'all 0.3s ease',
                  transform: lesson.isUnlocked && !lesson.isCompleted ? 'scale(1.02)' : 'none',
                  borderColor: lesson.isUnlocked && !lesson.isCompleted ? '#d8b4fe' : '#e2e8f0'
                }}>
                  
                  {/* Header info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '800', 
                      letterSpacing: '0.05em', 
                      textTransform: 'uppercase',
                      color: lesson.isCompleted 
                        ? '#059669' 
                        : lesson.isUnlocked 
                          ? '#8b5cf6' 
                          : '#94a3b8'
                    }}>
                      LEVEL {lesson.order} • {lesson.isCompleted ? 'Completed' : lesson.isUnlocked ? 'Active' : 'Locked'}
                    </span>
                    
                    {lesson.isCompleted && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#059669', fontWeight: '700', backgroundColor: '#ecfdf5', padding: '4px 8px', borderRadius: '20px' }}>
                        <Award size={14} /> Passed
                      </span>
                    )}
                  </div>

                  {/* Title & Desc */}
                  <h4 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '0.5rem', color: '#1e293b' }}>
                    {lesson.title}
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                    {lesson.objective}
                  </p>

                  {/* Vocabulary Tags */}
                  {lesson.targetVocabulary && lesson.targetVocabulary.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                      {lesson.targetVocabulary.map((vocab, vIdx) => (
                        <span 
                          key={vIdx}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: lesson.isUnlocked ? '#f3e8ff' : '#f1f5f9',
                            color: lesson.isUnlocked ? '#6b21a8' : '#64748b'
                          }}
                        >
                          📖 {vocab}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* CTA Action Button */}
                  {lesson.isUnlocked && (
                    <button 
                      onClick={() => onStartLesson(lesson)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        boxShadow: lesson.isCompleted ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.25)',
                        backgroundColor: lesson.isCompleted ? '#f1f5f9' : '#8b5cf6',
                        color: lesson.isCompleted ? '#475569' : 'white'
                      }}
                    >
                      {lesson.isCompleted ? (
                        <>Replay Practice</>
                      ) : (
                        <>Start Level <Play size={14} fill="white" /></>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Progress;
