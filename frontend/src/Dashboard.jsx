import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';
import { Flame, CheckCircle2, ArrowRight } from 'lucide-react';

function Dashboard({ student, onNewSession, onViewHistory }) {
  const [recentSessions, setRecentSessions] = useState([]);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [levelProgress, setLevelProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch student's sessions and all lessons for their level in parallel
        const [sessionsRes, lessonsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/sessions?studentId=${student.studentId}`),
          fetch(`${API_BASE_URL}/lessons?level=${student.cefrLevel}`)
        ]);

        let userSessions = [];
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          userSessions = sessionsData.sessions || [];
          
          // Sort for recent sessions
          const sorted = [...userSessions]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5);
          setRecentSessions(sorted);
          setTotalSessionsCount(userSessions.length);
        }

        if (lessonsRes.ok) {
          const lessonsData = await lessonsRes.json();
          const lessonsList = lessonsData.lessons || [];

          // Find the set of lessonIds the user has passed (passed = true)
          const passedLessonIds = new Set(
            userSessions.filter(s => s.passed).map(s => s.lessonId)
          );

          // Calculate completed lessons for current CEFR level
          const completedCount = lessonsList.filter(l => passedLessonIds.has(l.lessonId)).length;
          const totalCount = lessonsList.length;
          const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          
          setLevelProgress(progressPercent);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [student.studentId, student.cefrLevel]);

  const getNextCefrLevel = (currentLevel) => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const idx = levels.indexOf(currentLevel?.toUpperCase());
    if (idx === -1 || idx === levels.length - 1) return 'C2';
    return levels[idx + 1];
  };

  const getLessonEmoji = (lessonId) => {
    switch (lessonId) {
      case 'l1_meeting': return '🤝';
      case 'l2_cafe': return '☕';
      case 'l3_directions': return '🗺️';
      case 'l4_hotel': return '🔑';
      case 'l5_interview': return '💼';
      case 'l6_negotiation': return '🤝';
      case 'l7_ethics': return '🤖';
      default: return '🎯';
    }
  };

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greetingTime = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  return (
    <div style={{ width: '100%' }}>
      {/* Greeting Section */}
      <div className="dashboard-greeting">
        <h2>Good {greetingTime}, {student.name.split(' ')[0]}! 👋</h2>
        <p>Let's practice speaking and build your confidence.</p>
      </div>

      {/* Hero Mission Card */}
      {student.currentLesson && (
        <div className="hero-mission-card">
          <div className="hero-mission-content">
            <div className="hero-mission-header">
              <div className="hero-mission-icon">
                <span role="img" aria-label="Lesson Emoji">{getLessonEmoji(student.currentLesson.lessonId)}</span>
              </div>
              <div className="hero-mission-titles">
                <span className="hero-mission-subtitle">Today's Mission</span>
                <h3 className="hero-mission-title">{student.currentLesson.title}</h3>
              </div>
            </div>

            <div className="hero-mission-badges">
              <span className="hero-badge">⏱️ 10 Turns Max</span>
              <span className="hero-badge">📊 {student.currentLesson.cefrLevel} Level</span>
              <span className="hero-badge">📖 {student.currentLesson.targetVocabulary?.length || 0} Vocab Words</span>
            </div>

            <p className="hero-mission-desc">
              {student.currentLesson.objective || 'Practice speaking naturally and building confidence in real-world scenarios.'}
            </p>

            <button className="hero-start-btn" onClick={onNewSession}>
              Start Session <ArrowRight size={18} />
            </button>
          </div>
          
          <div className="hero-mission-illustration">
            <img src="/mission_illustration.png" alt="Mission Illustration" />
          </div>
        </div>
      )}

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
      
    </div>
  );
}

export default Dashboard;
