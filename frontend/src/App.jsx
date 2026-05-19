import React, { useState, useEffect } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';
import Session from './Session';
import History from './History';
import Layout from './Layout';

function App() {
  const [currentView, setCurrentView] = useState('LOADING');
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const savedStudent = localStorage.getItem('speech_ai_student');
    if (savedStudent) {
      setStudent(JSON.parse(savedStudent));
      setCurrentView('DASHBOARD');
    } else {
      setCurrentView('LOGIN');
    }
  }, []);

  const handleLoginSuccess = (studentData) => {
    localStorage.setItem('speech_ai_student', JSON.stringify(studentData));
    setStudent(studentData);
    setCurrentView('DASHBOARD');
  };

  const handleLogout = () => {
    localStorage.removeItem('speech_ai_student');
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
              onNewSession={() => setCurrentView('SESSION')}
              onViewHistory={() => setCurrentView('HISTORY')}
            />
          )}
          
          {currentView === 'SESSION' && (
            <Session 
              student={student} 
              onViewDashboard={() => setCurrentView('DASHBOARD')}
              onSessionComplete={(updatedStudent) => {
                setStudent(updatedStudent);
                localStorage.setItem('speech_ai_student', JSON.stringify(updatedStudent));
              }}
            />
          )}

          {currentView === 'HISTORY' && (
            <History 
              student={student} 
              onBack={() => setCurrentView('DASHBOARD')} 
            />
          )}
        </Layout>
      )}
    </div>
  );
}

export default App;
