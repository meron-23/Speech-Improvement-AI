import React, { useState } from 'react';
import { auth } from './firebase';
import { signInWithCustomToken } from 'firebase/auth';
import API_BASE_URL from './config';

function Login({ onLogin }) {
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Sign in with Firebase (optional depending on if frontend queries DB directly, 
      // but good practice as required by prompt)
      // await signInWithCustomToken(auth, data.token);
      
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
    <div className="login-page">
      <div className="login-card-container">
        <div className="login-info-section">
          <h1>Master Your English Speaking</h1>
          <p>Practice with our AI-powered partner and get instant feedback on your fluency and grammar.</p>
          
          <ul className="features-list">
            <li>Interactive AI Conversations</li>
            <li>Real-time Speech Transcription</li>
            <li>CEFR-based Level Tracking</li>
            <li>Detailed Performance Feedback</li>
          </ul>
        </div>

        <div className="login-form-section">
          <h2>Welcome Back</h2>
          <p>Please enter your Student ID to continue</p>
          
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-main)' }}>Student ID</label>
              <input 
                type="text" 
                placeholder="e.g. student001" 
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
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Need help? Contact your administrator.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
