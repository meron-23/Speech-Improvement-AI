import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';
import { 
  User, Volume2, Clock, Check, Loader2, 
  AlertCircle, Shield, Sliders, Globe 
} from 'lucide-react';

function Settings({ student, onUpdateStudent }) {
  const [name, setName] = useState(student.name || '');
  const [cefrLevel, setCefrLevel] = useState(student.cefrLevel || 'A1');
  const [silenceTimeout, setSilenceTimeout] = useState(2.5);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [tutorVoiceGender, setTutorVoiceGender] = useState('male');

  // Load custom configurations on mount
  useEffect(() => {
    const savedTimeout = localStorage.getItem('speech_silence_timeout');
    if (savedTimeout) {
      setSilenceTimeout(Number(savedTimeout) / 1000);
    }
    const savedTutorGender = localStorage.getItem('tutor_voice_gender');
    if (savedTutorGender) {
      setTutorVoiceGender(savedTutorGender);
    }
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');

    try {
      // 1. Update Profile in Firestore
      const authHeader = student?.token ? { 'Authorization': `Bearer ${student.token}` } : {};
      const res = await fetch(`${API_BASE_URL}/student/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          studentId: student.studentId,
          name,
          cefrLevel
        })
      });


      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to update profile settings");
      }

      const resData = await res.json();
      
      // 2. Save Speech Pipeline configs locally in localStorage
      localStorage.setItem('speech_silence_timeout', String(silenceTimeout * 1000));
      localStorage.setItem('tutor_voice_gender', tutorVoiceGender);


      // 3. Notify App to update local state and storage
      if (onUpdateStudent) {
        onUpdateStudent(resData.student);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred while saving your configurations.");
    } finally {
      setSaving(false);
    }
  };

  const [testingVoice, setTestingVoice] = useState(false);

  const handlePlayVoiceTest = async () => {
    if (testingVoice) return;
    setTestingVoice(true);
    const authHeader = student?.token ? { 'Authorization': `Bearer ${student.token}` } : {};
    try {
      const res = await fetch(`${API_BASE_URL}/speech/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          text: "Welcome! I'm your AI English tutor. Let's practice speaking together.",
          voice_gender: tutorVoiceGender
        })
      });
      const data = await res.json();
      if (data.audio) {
        const audioSrc = data.audio.startsWith('data:')
          ? data.audio
          : `data:audio/mp3;base64,${data.audio}`;
        const audio = new Audio(audioSrc);
        audio.onended = () => setTestingVoice(false);
        audio.onerror = () => setTestingVoice(false);
        audio.play().catch(() => setTestingVoice(false));
      } else {
        setTestingVoice(false);
      }
    } catch (err) {
      console.error('Voice test failed:', err);
      setTestingVoice(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '1000px', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div className="dashboard-greeting" style={{ marginBottom: '2rem' }}>
        <h2>System Configurations ⚙️</h2>
        <p>Personalize your voice training parameters and CEFR settings.</p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Status Alerts */}
        {success && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: '16px', fontWeight: '700' }}>
            <Check size={20} /> Settings saved successfully!
          </div>
        )}
        
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '16px', fontWeight: '700' }}>
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* Section 1: User Profile Settings */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <User size={20} color="#8b5cf6" /> Profile Settings
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Display Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b' }}>Full Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required
                style={{ 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  border: '1px solid #cbd5e1', 
                  fontSize: '0.95rem',
                  outline: 'none',
                  color: '#334155',
                  transition: 'border 0.2s',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>

            {/* CEFR Placement */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b' }}>CEFR Level Placement</label>
              <select 
                value={cefrLevel} 
                onChange={(e) => setCefrLevel(e.target.value)}
                style={{ 
                  padding: '12px 16px', 
                  borderRadius: '12px', 
                  border: '1px solid #cbd5e1', 
                  fontSize: '0.95rem',
                  outline: 'none',
                  color: '#334155',
                  backgroundColor: '#f8fafc'
                }}
              >
                <option value="A1">A1 - Beginner</option>
                <option value="A2">A2 - Elementary</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper-Intermediate</option>
                <option value="C1">C1 - Advanced</option>
              </select>
              <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: '700', marginTop: '2px' }}>
                ⚠️ Warning: Changing CEFR level resets your current active practice level.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Speech Training Pipeline */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <Sliders size={20} color="#8b5cf6" /> Speech Engine Settings
          </h3>

          {/* Silence Timeout Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: '800', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Silence Detection Timeout
              </label>
              <span style={{ fontSize: '1.05rem', fontWeight: '900', color: '#8b5cf6' }}>{silenceTimeout} seconds</span>
            </div>
            
            <input 
              type="range" 
              min="1.5" 
              max="4.0" 
              step="0.5" 
              value={silenceTimeout} 
              onChange={(e) => setSilenceTimeout(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#8b5cf6' }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600' }}>
              <span>1.5s (Fluent / Fast Response)</span>
              <span>2.5s (Standard)</span>
              <span>4.0s (Beginner / Long Pauses)</span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.825rem', lineHeight: '1.4', marginTop: '4px' }}>
              Sets the silence duration we monitor before compiling your spoken voice and submitting it to the AI. Set this higher if you need more time to recall words without the AI interrupting.
            </p>
          </div>
        </div>

        {/* Section 3: Audio Pronunciation Preferences */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <Globe size={20} color="#8b5cf6" /> Audio & Tutor Voice
          </h3>

          {/* Tutor Persona Voice Selector */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', display: 'block', marginBottom: '8px' }}>
              Conversation Tutor Persona & Voice
            </label>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '0 0 12px 0' }}>
              Choose whether you prefer a male or female voice for English conversation and Amharic coaching.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setTutorVoiceGender('male');
                  localStorage.setItem('tutor_voice_gender', 'male');
                }}
                style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  border: tutorVoiceGender === 'male' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  backgroundColor: tutorVoiceGender === 'male' ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  boxShadow: tutorVoiceGender === 'male' ? '0 4px 12px rgba(59, 130, 246, 0.15)' : 'none'
                }}
              >
                <div style={{ fontSize: '2rem' }}>👨</div>
                <div>
                  <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem' }}>Simon (Male Tutor)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Microsoft Edge · Guy (English) · Ameha (Amharic)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTutorVoiceGender('female');
                  localStorage.setItem('tutor_voice_gender', 'female');
                }}
                style={{
                  padding: '14px 18px',
                  borderRadius: '16px',
                  border: tutorVoiceGender === 'female' ? '2px solid #ec4899' : '1px solid #e2e8f0',
                  backgroundColor: tutorVoiceGender === 'female' ? '#fdf2f8' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  boxShadow: tutorVoiceGender === 'female' ? '0 4px 12px rgba(236, 72, 153, 0.15)' : 'none'
                }}
              >
                <div style={{ fontSize: '2rem' }}>👩</div>
                <div>
                  <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.95rem' }}>Hamen (Female Tutor)</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Microsoft Edge · Jenny (English) · Mekdes (Amharic)</div>
                </div>
              </button>
            </div>
          </div>

          {/* Voice info badge + test button */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 16px', borderRadius: '12px',
              backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
              fontSize: '0.82rem', color: '#15803d', fontWeight: '600'
            }}>
              <Volume2 size={14} />
              Active voice: Microsoft Edge Neural &mdash;&nbsp;
              {tutorVoiceGender === 'female' ? 'Jenny (EN) · Mekdes (AM)' : 'Guy (EN) · Ameha (AM)'}
            </div>
            <button
              type="button"
              onClick={handlePlayVoiceTest}
              disabled={testingVoice}
              style={{
                padding: '10px 20px',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                backgroundColor: testingVoice ? '#f1f5f9' : 'white',
                color: testingVoice ? '#94a3b8' : '#475569',
                fontWeight: '700',
                fontSize: '0.9rem',
                cursor: testingVoice ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <Volume2 size={15} />
              {testingVoice ? 'Playing…' : 'Preview Voice'}
            </button>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button 
            type="submit" 
            disabled={saving}
            style={{
              padding: '14px 40px',
              borderRadius: '14px',
              backgroundColor: '#86198f',
              color: 'white',
              fontWeight: '700',
              fontSize: '1rem',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(134, 25, 143, 0.25)',
              opacity: saving ? 0.8 : 1
            }}
          >
            {saving && <Loader2 size={18} className="spin-icon" />}
            Save Configurations
          </button>
        </div>

      </form>
    </div>
  );
}

export default Settings;
