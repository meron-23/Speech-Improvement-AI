import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import Session from './Session';
import History from './History';
import Progress from './Progress.jsx';
import Settings from './Settings';
import Vocabulary from './Vocabulary';
import Writing from './Writing';
import Layout from './Layout';
import API_BASE_URL from './config';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [student, setStudent] = useState(null);
  const [showTestPrompt, setShowTestPrompt] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [amharic, setAmharic] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  // --- Shared cached data (fetched once, passed as props) ---
  const [sharedSessions, setSharedSessions] = useState([]);
  const [sharedLessons, setSharedLessons] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchSharedData = useCallback(async (studentData) => {
    if (!studentData) return;
    setDataLoading(true);
    try {
      const headers = studentData.token ? { 'Authorization': `Bearer ${studentData.token}` } : {};
      const [sessionsRes, lessonsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/sessions?studentId=${studentData.studentId}`, { headers }),
        fetch(`${API_BASE_URL}/lessons?level=${studentData.cefrLevel}`, { headers })
      ]);
      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSharedSessions((data.sessions || []).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
      }
      if (lessonsRes.ok) {
        const data = await lessonsRes.json();
        setSharedLessons((data.lessons || []).sort((a, b) => a.order - b.order));
      }
    } catch (err) {
      console.error('Failed to fetch shared data:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const refreshStudentAndData = useCallback(async (currentStudent) => {
    const s = currentStudent;
    if (!s) return;
    fetchSharedData(s);
    try {
      const headers = s.token ? { 'Authorization': `Bearer ${s.token}` } : {};
      const res = await fetch(`${API_BASE_URL}/student/${s.studentId}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.student) {
        const fresh = { ...data.student, token: s.token };
        setStudent(fresh);
        localStorage.setItem('speech_ai_student', JSON.stringify(fresh));
        if (fresh.levelComplete) setShowTestPrompt(true);
        fetchSharedData(fresh);
      }
    } catch (err) {
      console.error('Error syncing student profile on dashboard return:', err);
    }
  }, [fetchSharedData]);

  useEffect(() => {
    const savedStudent = localStorage.getItem('speech_ai_student');
    if (savedStudent) {
      const parsed = JSON.parse(savedStudent);
      setStudent(parsed);
      if (parsed.levelComplete) setShowTestPrompt(true);
      fetchSharedData(parsed);

      const headers = parsed.token ? { 'Authorization': `Bearer ${parsed.token}` } : {};
      fetch(`${API_BASE_URL}/student/${parsed.studentId}`, { headers })
        .then(res => {
          if (!res.ok) throw new Error('Profile sync failed');
          return res.json();
        })
        .then(data => {
          if (data.student) {
            const fresh = { ...data.student, token: parsed.token };
            setStudent(fresh);
            localStorage.setItem('speech_ai_student', JSON.stringify(fresh));
            if (data.student.levelComplete) setShowTestPrompt(true);
          }
        })
        .catch(err => console.error("Error syncing student profile on load:", err))
        .finally(() => setIsInitializing(false));
    } else {
      setIsInitializing(false);
    }
  }, [fetchSharedData]);

  const handleLoginSuccess = (studentData) => {
    localStorage.setItem('speech_ai_student', JSON.stringify(studentData));
    setStudent(studentData);
    if (studentData.levelComplete) setShowTestPrompt(true);
    fetchSharedData(studentData);
    navigate('/dashboard');
  };

  const handleUpdateStudent = (updatedStudent) => {
    setStudent(updatedStudent);
    localStorage.setItem('speech_ai_student', JSON.stringify(updatedStudent));
  };

  const handleLogout = () => {
    localStorage.removeItem('speech_ai_student');
    setStudent(null);
    navigate('/login');
  };

  if (isInitializing) return null;

  return (
    <div className="app-container">
      <Routes>
        <Route
          path="/login"
          element={
            student ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLoginSuccess} amharic={amharic} setAmharic={setAmharic} />
          }
        />
        <Route
          path="/*"
          element={
            !student ? (
              <Navigate to="/login" replace />
            ) : (
              <Layout
                student={student}
                onLogout={handleLogout}
                amharic={amharic}
                setAmharic={setAmharic}
              >
                <Routes>
                  <Route
                    path="dashboard"
                    element={
                      <Dashboard
                        student={student}
                        sessions={sharedSessions}
                        lessons={sharedLessons}
                        dataLoading={dataLoading}
                        amharic={amharic}
                        onNewSession={(lesson) => {
                          setSelectedLesson(lesson || null);
                          navigate('/session');
                        }}
                        onViewHistory={() => navigate('/history')}
                      />
                    }
                  />
                  <Route
                    path="session"
                    element={
                      <Session
                        student={student}
                        customLesson={selectedLesson}
                        amharic={amharic}
                        onViewDashboard={() => {
                          setSelectedLesson(null);
                          navigate('/dashboard');
                          refreshStudentAndData(student);
                        }}
                        onSessionComplete={(updatedStudent) => {
                          setStudent(updatedStudent);
                          localStorage.setItem('speech_ai_student', JSON.stringify(updatedStudent));
                          if (updatedStudent.levelComplete) setShowTestPrompt(true);
                          setSelectedLesson(null);
                          fetchSharedData(updatedStudent);
                        }}
                      />
                    }
                  />
                  <Route
                    path="history"
                    element={
                      <History
                        student={student}
                        sessions={sharedSessions}
                        lessons={sharedLessons}
                        dataLoading={dataLoading}
                        amharic={amharic}
                        onBack={() => navigate('/dashboard')}
                      />
                    }
                  />
                  <Route
                    path="progress"
                    element={
                      <Progress
                        student={student}
                        sessions={sharedSessions}
                        lessons={sharedLessons}
                        dataLoading={dataLoading}
                        amharic={amharic}
                        onStartLesson={(lesson) => {
                          setSelectedLesson(lesson || null);
                          navigate('/session');
                        }}
                      />
                    }
                  />
                  <Route
                    path="vocabulary"
                    element={
                      <Vocabulary
                        student={student}
                        sessions={sharedSessions}
                        lessons={sharedLessons}
                        dataLoading={dataLoading}
                        amharic={amharic}
                      />
                    }
                  />
                  <Route
                    path="writing"
                    element={
                      <Writing
                        student={student}
                        amharic={amharic}
                        onNavigateToPractice={() => navigate('/dashboard')}
                      />
                    }
                  />
                  <Route
                    path="settings"
                    element={
                      <Settings
                        student={student}
                        onUpdateStudent={handleUpdateStudent}
                      />
                    }
                  />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            )
          }
        />
      </Routes>

      {showTestPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(26, 15, 28, 0.7)',
          backdropFilter: 'blur(12px) saturate(180%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem'
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: '#ffffff',
            borderRadius: '24px',
            padding: '3rem 2.5rem',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(158, 40, 145, 0.1)',
            animation: 'popIn 0.3s ease-out'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              backgroundColor: 'rgba(27, 107, 74, 0.1)',
              color: '#1B6B4A',
              boxShadow: '0 8px 16px rgba(27, 107, 74, 0.1)'
            }}>
              🏆
            </div>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '800',
              marginBottom: '1rem',
              background: 'linear-gradient(135deg, #1A1A5C 0%, #1B6B4A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em'
            }}>
              Level Complete!
            </h2>
            <p style={{
              color: '#5b4e5d',
              marginBottom: '2rem',
              lineHeight: '1.6',
              fontSize: '1rem'
            }}>
              Outstanding job! You have successfully mastered all lessons for this proficiency level.
              To unlock your next level and curriculum, please complete the external CEFR assessment.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <a
                href="https://example.com/cefR-test"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#E8533A',
                  color: '#ffffff',
                  borderRadius: '100px',
                  fontWeight: '700',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  boxShadow: '0 8px 20px rgba(232, 83, 58, 0.35)',
                  boxSizing: 'border-box'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#d14428'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#E8533A'}
              >
                Take the CEFR Test 🌟
              </a>
              <button
                onClick={() => setShowTestPrompt(false)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'transparent',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  color: '#665b68',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Continue to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
