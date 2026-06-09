import React, { useState, useEffect } from 'react';
import { Flame, CheckCircle2, Lock, PlayCircle } from 'lucide-react';

function Dashboard({ student, sessions, lessons, dataLoading, onNewSession, onViewHistory }) {
  const [modules, setModules] = useState([]);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [passedLessonIds, setPassedLessonIds] = useState(new Set());
  const [levelProgress, setLevelProgress] = useState(0);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);

  // Derive everything from the props whenever sessions or lessons change
  useEffect(() => {
    const passedIds = new Set(
      sessions.filter(s => s.passed).map(s => s.lessonId)
    );
    setPassedLessonIds(passedIds);
    setTotalSessionsCount(sessions.length);

    const completedCount = lessons.filter(l => passedIds.has(l.lessonId)).length;
    const totalCount = lessons.length;
    setLevelProgress(totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0);

    // Group lessons into modules
    const modulesMap = {};
    lessons.forEach(lesson => {
      const modId = lesson.moduleId || 'unknown';
      if (!modulesMap[modId]) {
        modulesMap[modId] = {
          id: modId,
          title: lesson.moduleTitle || 'General',
          order: lesson.moduleOrder || 999,
          tasks: []
        };
      }
      modulesMap[modId].tasks.push(lesson);
    });

    const modulesArr = Object.values(modulesMap).sort((a, b) => a.order - b.order);
    modulesArr.forEach(mod => {
      mod.tasks.sort((a, b) => (a.taskOrder || a.order) - (b.taskOrder || b.order));
    });
    setModules(modulesArr);

    // Auto-select the active module
    const currentModId = student.currentLesson?.moduleId;
    if (currentModId && modulesArr.find(m => m.id === currentModId)) {
      setActiveModuleId(currentModId);
    } else if (modulesArr.length > 0) {
      setActiveModuleId(prev => prev || modulesArr[0].id);
    }
  }, [sessions, lessons, student.currentLesson]);

  const getNextCefrLevel = (currentLevel) => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const idx = levels.indexOf(currentLevel?.toUpperCase());
    if (idx === -1 || idx === levels.length - 1) return 'C2';
    return levels[idx + 1];
  };

  const getLessonEmoji = (lessonId) => {
    if (!lessonId) return '🎯';
    const l = lessonId.toLowerCase();
    if (l.includes('meeting') || l.includes('greeting') || l.includes('introduce')) return '🤝';
    if (l.includes('cafe')) return '☕';
    if (l.includes('market') || l.includes('shop')) return '🛍️';
    if (l.includes('direction') || l.includes('travel')) return '🗺️';
    if (l.includes('hotel')) return '🏨';
    if (l.includes('interview')) return '💼';
    if (l.includes('negotiation')) return '📊';
    if (l.includes('ethics')) return '🤖';
    if (l.includes('feelings') || l.includes('stress')) return '❤️';
    if (l.includes('emergency')) return '🚨';
    if (l.includes('office') || l.includes('work')) return '🏢';
    if (l.includes('review')) return '⭐';
    return '🎯';
  };

  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  const activeModule = modules.find(m => m.id === activeModuleId);

  return (
    <div style={{ width: '100%', paddingBottom: '40px' }}>
      {/* Greeting Section */}
      <div className="dashboard-greeting">
        <h2>Good {greetingTime}, {student.name.split(' ')[0]}! 👋</h2>
        <p>Let's continue your journey in English.</p>
      </div>

      {/* Stats Row */}
      <div className="dashboard-stats-row">
        <div className="dashboard-stat-card">
          <div className="stat-icon-wrapper fire">
            <Flame size={24} color="#f97316" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{student.practiceStreak || 0}</span>
            <span className="stat-label">Day Streak</span>
          </div>
        </div>

        <div className="dashboard-stat-card">
          <div className="stat-icon-wrapper check">
            <CheckCircle2 size={24} color="#8b5cf6" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{totalSessionsCount}</span>
            <span className="stat-label">Sessions Completed</span>
          </div>
        </div>

        <div className="dashboard-stat-card progress-card">
          <div className="cefr-circle">
            {student.cefrLevel}
          </div>
          <div className="cefr-progress-info">
            <span className="progress-label">{levelProgress}% to {getNextCefrLevel(student.cefrLevel)}</span>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${levelProgress}%` }}></div>
            </div>
            <span className="progress-subtext">CEFR Progress</span>
          </div>
        </div>
      </div>

      {/* Current Mission Banner */}
      {student.currentLesson && (
        <div className="current-mission-banner" onClick={onNewSession}>
          <div className="mission-banner-info">
            <span className="mission-banner-label">Active Mission</span>
            <h3>{student.currentLesson.title}</h3>
            <p>{student.currentLesson.objective}</p>
          </div>
          <button className="mission-banner-btn">
            Start Now <PlayCircle size={18} />
          </button>
        </div>
      )}

      {/* Learning Roadmap with Tabs */}
      <div className="roadmap-container">
        <div className="roadmap-header">
            <h3 className="roadmap-title">Learning Pathway - {student.cefrLevel}</h3>
        </div>
        
        {dataLoading ? (
          <div className="roadmap-loading">Loading roadmap...</div>
        ) : (
          <>
            <div className="module-tabs-container">
              {modules.map((mod, index) => (
                <button 
                  key={mod.id} 
                  className={`module-tab ${activeModuleId === mod.id ? 'active' : ''}`}
                  onClick={() => setActiveModuleId(mod.id)}
                >
                  <span className="module-tab-number">M{index + 1}</span>
                  <span className="module-tab-title">{mod.title}</span>
                </button>
              ))}
            </div>

            <div className="roadmap-modules">
              {activeModule && (
                <div className="roadmap-module animate-fade-in">
                  <div className="module-tasks">
                    {activeModule.tasks.map((task, tIndex) => {
                      const isPassed = passedLessonIds.has(task.lessonId);
                      const isCurrent = student.currentLesson?.lessonId === task.lessonId;
                      const isLocked = !isPassed && !isCurrent;
                      const isLastInModule = tIndex === activeModule.tasks.length - 1;
                      
                      let taskClass = "roadmap-task";
                      if (isPassed) taskClass += " passed";
                      if (isCurrent) taskClass += " current";
                      if (isLocked) taskClass += " locked";

                      return (
                        <div key={task.lessonId} className={taskClass} onClick={() => {
                          if (!isLocked) onNewSession(task);
                        }}>
                          <div className="task-icon-area">
                            <div className={`task-icon ${isPassed ? 'check' : isCurrent ? 'play' : 'lock'}`}>
                              {isPassed ? <CheckCircle2 size={20} /> : isCurrent ? <PlayCircle size={20} /> : <Lock size={18} />}
                            </div>
                            {/* Connector line */}
                            {!isLastInModule && <div className={`task-connector ${isPassed ? 'passed' : ''}`}></div>}
                          </div>
                          
                          <div className="task-content">
                            <div className="task-emoji">{getLessonEmoji(task.lessonId)}</div>
                            <div className="task-details">
                              <h5>{task.title}</h5>
                              <span className="task-meta">
                                {task.targetVocabulary?.length || 0} vocabulary words
                              </span>
                            </div>
                            
                            {isCurrent && (
                              <span className="task-badge current">Current</span>
                            )}
                            {isPassed && (
                              <span className="task-badge review">Passed</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
    </div>
  );
}

export default Dashboard;
