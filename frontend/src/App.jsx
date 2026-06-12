import React, { useState, useEffect, useCallback } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Session from './Session';
import History from './History';
import Progress from './Progress.jsx';

import Settings from './Settings';
import Layout from './Layout';
import API_BASE_URL from './config';

function App() {
  const [currentView, setCurrentView] = useState('LOADING');
  const [student, setStudent] = useState(null);
  const [showTestPrompt, setShowTestPrompt] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(null);

  // --- Shared cached data (fetched once, passed as props) ---
  const [sharedSessions, setSharedSessions] = useState([]);
  const [sharedLessons, setSharedLessons] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);

  const fetchSharedData = useCallback(async (studentData) => {
    if (!studentData) return;
    setDataLoading(true);
    try {
      const [sessionsRes, lessonsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/sessions?studentId=${studentData.studentId}`),
        fetch(`${API_BASE_URL}/lessons?level=${studentData.cefrLevel}`)
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

  useEffect(() => {
    const savedStudent = localStorage.getItem('speech_ai_student');
    if (savedStudent) {
      const parsed = JSON.parse(savedStudent);
      setStudent(parsed);
      
      // Restore saved view or default to DASHBOARD
      const savedView = localStorage.getItem('speech_ai_view');
      setCurrentView(savedView || 'DASHBOARD');
      
      if (parsed.levelComplete) setShowTestPrompt(true);

      // Fetch shared data (sessions + lessons) once on load
      fetchSharedData(parsed);

      // Perform a background sync with Firestore to fetch the absolute freshest profile state
      fetch(`${API_BASE_URL}/student/${parsed.studentId}`)
        .then(res => {
          if (!res.ok) throw new Error('Profile sync failed');
          return res.json();
        })
        .then(data => {
          if (data.student) {
            setStudent(data.student);
            localStorage.setItem('speech_ai_student', JSON.stringify(data.student));
            if (data.student.levelComplete) {
              setShowTestPrompt(true);
            } else {
              setShowTestPrompt(false);
            }
          }
        })
        .catch(err => console.error("Error syncing student profile on load:", err));
    } else {
      setCurrentView('LOGIN');
    }
  }, [fetchSharedData]);

  // Sync currentView changes to localStorage to persist tab across refreshes
  useEffect(() => {
    if (currentView !== 'LOADING' && currentView !== 'LOGIN') {
      localStorage.setItem('speech_ai_view', currentView);
    }
  }, [currentView]);

  const handleLoginSuccess = (studentData) => {
    localStorage.setItem('speech_ai_student', JSON.stringify(studentData));
    setStudent(studentData);
    setCurrentView('DASHBOARD');
    if (studentData.levelComplete) setShowTestPrompt(true);
    fetchSharedData(studentData);
  };

  const handleUpdateStudent = (updatedStudent) => {
    setStudent(updatedStudent);
    localStorage.setItem('speech_ai_student', JSON.stringify(updatedStudent));
  };

  const handleLogout = () => {
    localStorage.removeItem('speech_ai_student');
    localStorage.removeItem('speech_ai_view');
    setStudent(null);
    setCurrentView('LOGIN');
  };

  if (currentView === 'LOADING') return null;

  return (
    <div className="app-container">
      {currentView === 'LOGIN' ? (
        <Login onLogin={handleLoginSuccess} />
      ) : (
        <Layout 
          student={student} 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
          onLogout={handleLogout}
        >
          {currentView === 'DASHBOARD' && (
            <Dashboard 
              student={student}
              sessions={sharedSessions}
              lessons={sharedLessons}
              dataLoading={dataLoading}
              onNewSession={(lesson) => {
                setSelectedLesson(lesson || null);
                setCurrentView('SESSION');
              }}
              onViewHistory={() => setCurrentView('HISTORY')}
            />
          )}
          
          {currentView === 'SESSION' && (
            <Session 
              student={student} 
              customLesson={selectedLesson}
              onViewDashboard={() => {
                setSelectedLesson(null);
                setCurrentView('DASHBOARD');
              }}
              onSessionComplete={(updatedStudent) => {
                setStudent(updatedStudent);
                localStorage.setItem('speech_ai_student', JSON.stringify(updatedStudent));
                if (updatedStudent.levelComplete) setShowTestPrompt(true);
                setSelectedLesson(null);
                // Refresh sessions cache after a new session is saved
                fetchSharedData(updatedStudent);
              }}
            />
          )}

          {currentView === 'HISTORY' && (
            <History 
              student={student}
              sessions={sharedSessions}
              dataLoading={dataLoading}
              onBack={() => setCurrentView('DASHBOARD')} 
            />
          )}

          {currentView === 'PROGRESS' && (
            <Progress 
              student={student}
              sessions={sharedSessions}
              lessons={sharedLessons}
              dataLoading={dataLoading}
              onStartLesson={(lesson) => {
                setSelectedLesson(lesson || null);
                setCurrentView('SESSION');
              }}
            />
          )}



          {currentView === 'SETTINGS' && (
            <Settings 
              student={student}
              onUpdateStudent={handleUpdateStudent}
            />
          )}
        </Layout>
      )}
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
              backgroundColor: 'rgba(158, 40, 145, 0.1)', 
              color: '#9E2891',
              boxShadow: '0 8px 16px rgba(158, 40, 145, 0.1)'
            }}>
              🏆
            </div>
            <h2 style={{ 
              fontSize: '2rem', 
              fontWeight: '800', 
              marginBottom: '1rem', 
              background: 'linear-gradient(135deg, #9E2891 0%, #e5a935 100%)',
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
                  backgroundColor: '#9E2891', 
                  color: '#ffffff', 
                  borderRadius: '12px', 
                  fontWeight: '700', 
                  textDecoration: 'none', 
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(158, 40, 145, 0.3)',
                  boxSizing: 'border-box'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b53ba7'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9E2891'}
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
