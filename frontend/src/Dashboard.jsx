import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';
import { Flame, CheckCircle2, ArrowRight } from 'lucide-react';

function Dashboard({ student, onNewSession, onViewHistory }) {
  const [recentSessions, setRecentSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentSessions = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/sessions?studentId=${student.studentId}`);
        if (res.ok) {
          const data = await res.json();
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

  // Example greeting based on time of day
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
                <span role="img" aria-label="Restaurant">🍽️</span>
              </div>
              <div className="hero-mission-titles">
                <span className="hero-mission-subtitle">Today's Mission</span>
                <h3 className="hero-mission-title">{student.currentLesson.title}</h3>
              </div>
            </div>

            <div className="hero-mission-badges">
              <span className="hero-badge">⏱️ 20-25 mins</span>
              <span className="hero-badge">📊 {student.currentLesson.cefrLevel} Level</span>
              <span className="hero-badge">📖 3 Vocabulary Words</span>
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
            <span className="stat-value">{recentSessions.length > 0 ? recentSessions.length + "+" : "0"}</span>
            <span className="stat-label">Sessions Completed</span>
          </div>
        </div>

        <div className="dashboard-stat-card progress-card">
          <div className="cefr-circle">
            {student.cefrLevel}
          </div>
          <div className="cefr-progress-info">
            <span className="progress-label">62% to B1</span>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: '62%' }}></div>
            </div>
            <span className="progress-subtext">CEFR Progress</span>
          </div>
        </div>
      </div>
      
    </div>
  );
}

export default Dashboard;
