import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithCustomToken } from 'firebase/auth';
import API_BASE_URL from './config';
import { AM, EN } from './Layout';

function Login({ onLogin, amharic, setAmharic }) {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const T = amharic ? AM : EN;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      onLogin({
        ...data.student,
        token: data.token
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ position: 'relative' }}>
      {/* Language toggle button — floating absolute top right */}
      <div style={{ position: 'absolute', top: '2.5rem', right: '4rem', zIndex: 100 }}>
        <button
          onClick={() => setAmharic(!amharic)}
          title={amharic ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
          style={{
            background: amharic ? '#9E2891' : '#ffffff',
            color:      amharic ? '#ffffff' : '#64748b',
            border: 'none',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.85rem',
            fontWeight: '700',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            transition: 'all 0.2s',
          }}
        >
          {amharic ? AM.languageAm : EN.language}
        </button>
      </div>

      <div className="login-card-container">
        <div className="login-info-section">
          <h1>{T.loginMasterTitle}</h1>
          <p>{T.loginMasterDesc}</p>
          
          <ul className="features-list">
            <li>{T.loginFeat1}</li>
            <li>{T.loginFeat2}</li>
            <li>{T.loginFeat3}</li>
            <li>{T.loginFeat4}</li>
          </ul>
        </div>

        <div className="login-form-section">
          <h2>{T.loginWelcome}</h2>
          <p>{T.loginWelcomeDesc}</p>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{T.studentIdLabel}</label>
              <input 
                type="text" 
                placeholder={T.studentIdPlaceholder} 
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                style={{ marginBottom: '0.5rem' }}
                required
              />
              {error && (
                <div className="error-text" style={{ 
                  marginTop: '0.75rem', 
                  padding: '10px 14px', 
                  backgroundColor: '#fef2f2', 
                  border: '1px solid #fee2e2', 
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '1rem' }}>⚠️</span> {error}
                </div>
              )}
            </div>
            
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: '12px' }}>
              {loading ? T.authenticating : T.signInBtn}
            </button>
          </form>

          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {T.loginNeedHelp}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
