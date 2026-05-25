import React, { useState, useEffect } from 'react';
import API_BASE_URL from './config';
import { 
  Volume2, Lock, CheckCircle2, BookOpen, Search, 
  Filter, Loader2, AlertCircle, Sparkles, MessageSquare 
} from 'lucide-react';

function Vocabulary({ student }) {
  const [lessons, setLessons] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter states for Spoken Dictionary
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCommon, setHideCommon] = useState(true);

  // Common/stop words to filter out if requested
  const COMMON_WORDS = new Set([
    'the', 'a', 'an', 'and', 'but', 'or', 'so', 'if', 'because', 'as', 
    'to', 'for', 'of', 'in', 'on', 'at', 'by', 'from', 'with', 'about', 
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    'my', 'your', 'his', 'her', 'its', 'our', 'their',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should',
    'this', 'that', 'these', 'those', 'there', 'here', 'then', 'than', 'too', 'very', 'just'
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch lessons for their level
        const lessonsRes = await fetch(`${API_BASE_URL}/lessons?level=${student.cefrLevel}`);
        if (!lessonsRes.ok) throw new Error("Failed to fetch curriculum");
        const lessonsData = await lessonsRes.json();
        const sortedLessons = (lessonsData.lessons || []).sort((a, b) => a.order - b.order);
        setLessons(sortedLessons);

        // 2. Fetch all student sessions
        const sessionsRes = await fetch(`${API_BASE_URL}/sessions?studentId=${student.studentId}`);
        if (!sessionsRes.ok) throw new Error("Failed to fetch session history");
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);

      } catch (err) {
        console.error(err);
        setError(err.message || "An error occurred loading vocabulary.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [student.studentId, student.cefrLevel]);

  // TTS Pronunciation speaker
  const playPronunciation = (word) => {
    if ('speechSynthesis' in window) {
      // Cancel active voice playbacks
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.rate = 0.85; // Slightly slower for clear instruction
      
      const savedVoiceURI = localStorage.getItem('speech_tts_voice_uri');
      const voices = window.speechSynthesis.getVoices();
      let matchedVoice = voices.find(v => v.voiceURI === savedVoiceURI);
      
      // Fallback matching to any English voice if URI not configured/found
      if (!matchedVoice) {
        matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith('en'));
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
        utterance.lang = matchedVoice.lang;
      } else {
        utterance.lang = 'en-US';
      }

      window.speechSynthesis.speak(utterance);
    } else {
      alert("Your browser does not support speech synthesis pronunciation.");
    }
  };

  // Compile the student's personal dictionary (spoken word frequencies)
  const getPersonalDictionary = () => {
    const counts = {};
    sessions.forEach(session => {
      (session.conversation || []).forEach(msg => {
        if (msg.role === 'user' && msg.text) {
          const words = msg.text
            .toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
            .split(/\s+/);
          
          words.forEach(word => {
            const w = word.trim();
            if (w) {
              if (hideCommon && COMMON_WORDS.has(w)) return;
              counts[w] = (counts[w] || 0) + 1;
            }
          });
        }
      });
    });

    // Convert to sorted array
    return Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .filter(item => item.word.includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.count - a.count);
  };

  // Compile Target Vocabulary lists with locks and mastery validation
  const getTargetVocabularyData = () => {
    const passedLessonIds = new Set(
      sessions.filter(s => s.passed).map(s => s.lessonId)
    );

    // Collect all words spoken by the user across *any* session
    const allSpokenText = sessions
      .flatMap(s => s.conversation || [])
      .filter(msg => msg.role === 'user' && msg.text)
      .map(msg => msg.text.toLowerCase())
      .join(' ');

    return lessons.map((lesson, idx) => {
      // Locking logic matching Progress.jsx
      const isFirst = idx === 0;
      const prevCompleted = !isFirst && passedLessonIds.has(lessons[idx - 1].lessonId);
      const isUnlocked = isFirst || prevCompleted || passedLessonIds.has(lesson.lessonId) || student.currentLesson?.lessonId === lesson.lessonId;

      const words = (lesson.targetVocabulary || []).map(vocab => {
        // Check if the user has said this vocab phrase/word
        // Simple substring check handles both single words and multi-word target phrases
        const isMastered = allSpokenText.includes(vocab.toLowerCase());

        return {
          phrase: vocab,
          status: !isUnlocked ? 'LOCKED' : isMastered ? 'MASTERED' : 'LEARNING'
        };
      });

      return {
        lessonId: lesson.lessonId,
        title: lesson.title,
        order: lesson.order,
        isUnlocked,
        words
      };
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, height: '60vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <Loader2 size={40} className="spin-icon" color="var(--primary)" />
        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Analyzing spoken transcripts...</span>
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

  const targetVocabGroups = getTargetVocabularyData();
  const personalDict = getPersonalDictionary();

  // Compute overall Target Vocabulary Mastery stats
  let totalTargetWords = 0;
  let masteredTargetWords = 0;
  targetVocabGroups.forEach(group => {
    group.words.forEach(w => {
      totalTargetWords++;
      if (w.status === 'MASTERED') masteredTargetWords++;
    });
  });
  const vocabMasteryPercent = totalTargetWords > 0 ? Math.round((masteredTargetWords / totalTargetWords) * 100) : 0;

  return (
    <div style={{ width: '100%', paddingBottom: '3rem' }}>
      
      {/* Header */}
      <div className="dashboard-greeting" style={{ marginBottom: '2rem' }}>
        <h2>Interactive Vocabulary Coach 📖</h2>
        <p>Master target phrases for your level and view your real spoken vocabulary database.</p>
      </div>

      {/* Overview Card */}
      <div className="card" style={{ background: 'white', padding: '1.75rem', borderRadius: '24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <div style={{
          width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(139, 92, 246, 0.1)',
          color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Sparkles size={32} />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.25rem', color: '#1e293b' }}>
            CEFR {student.cefrLevel} Target Vocabulary Mastery
          </h4>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            You have spoken and mastered <strong>{masteredTargetWords}</strong> of the <strong>{totalTargetWords}</strong> key phrases assigned to this level.
          </p>
        </div>
        <div style={{ width: '150px', textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#8b5cf6' }}>{vocabMasteryPercent}%</div>
          <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${vocabMasteryPercent}%`, background: '#8b5cf6', borderRadius: '4px' }}></div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'flex-start' }}>
        
        {/* Left Column: Target Curriculum Vocabulary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={20} color="#8b5cf6" /> Target Lesson Vocabulary
          </h3>

          {targetVocabGroups.map((group) => (
            <div 
              key={group.lessonId}
              style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '1.5rem',
                border: '1px solid #e2e8f0',
                opacity: group.isUnlocked ? 1 : 0.6
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: '#8b5cf6', letterSpacing: '0.05em' }}>
                    LESSON {group.order}
                  </span>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>
                    {group.title}
                  </h4>
                </div>
                {!group.isUnlocked && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94a3b8', background: '#f1f5f9', padding: '4px 8px', borderRadius: '12px', fontWeight: '700' }}>
                    <Lock size={12} /> Locked
                  </span>
                )}
              </div>

              {/* Word List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {group.words.map((w, wIdx) => {
                  const isLocked = w.status === 'LOCKED';
                  const isMastered = w.status === 'MASTERED';

                  return (
                    <div 
                      key={wIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1.25rem',
                        borderRadius: '14px',
                        border: '1px solid #f1f5f9',
                        backgroundColor: isMastered ? '#f0fdf4' : '#f8fafc',
                        borderColor: isMastered ? '#bbf7d0' : '#f1f5f9',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isLocked ? (
                          <Lock size={16} color="#cbd5e1" />
                        ) : isMastered ? (
                          <CheckCircle2 size={18} color="#16a34a" />
                        ) : (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                        )}
                        
                        <span style={{ 
                          fontWeight: '700', 
                          fontSize: '0.95rem',
                          color: isLocked ? '#94a3b8' : '#1e293b',
                          letterSpacing: isLocked ? '0.05em' : 'none'
                        }}>
                          {isLocked ? '••••••••••' : w.phrase}
                        </span>
                      </div>

                      {/* Right Action */}
                      {!isLocked && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            backgroundColor: isMastered ? '#d1fae5' : '#fffbeb',
                            color: isMastered ? '#065f46' : '#92400e'
                          }}>
                            {isMastered ? 'Mastered' : 'Learning'}
                          </span>

                          <button 
                            onClick={() => playPronunciation(w.phrase)}
                            style={{
                              background: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#64748b',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                            }}
                            title="Hear Pronunciation"
                          >
                            <Volume2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Spoken Dictionary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={20} color="#8b5cf6" /> My Spoken Dictionary
          </h3>

          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0'
          }}>
            {/* Search Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '8px 12px', marginBottom: '1rem', backgroundColor: '#f8fafc' }}>
              <Search size={16} color="#94a3b8" />
              <input 
                type="text" 
                placeholder="Search spoken words..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem', color: '#334155' }}
              />
            </div>

            {/* Toggle Filters */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} /> Filter Common Words
              </span>
              <button 
                onClick={() => setHideCommon(!hideCommon)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  backgroundColor: hideCommon ? '#f5f3ff' : 'white',
                  color: hideCommon ? '#8b5cf6' : '#64748b',
                  borderColor: hideCommon ? '#c084fc' : '#e2e8f0'
                }}
              >
                {hideCommon ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Dictionary List */}
            <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '4px' }}>
              {personalDict.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0', fontSize: '0.9rem' }}>
                  No spoken words matching filters.
                </div>
              ) : (
                personalDict.map((item, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155' }}>
                      {item.word}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: '800', 
                      background: '#e0e7ff', 
                      color: '#3730a3',
                      padding: '2px 8px',
                      borderRadius: '8px'
                    }}>
                      Used {item.count}x
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}

export default Vocabulary;
