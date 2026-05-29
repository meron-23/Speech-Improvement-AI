import React, { useState, useRef, useEffect } from 'react';
import API_BASE_URL from './config';
import { Mic, Loader2, Sparkles } from 'lucide-react';

function Session({ student, customLesson, onViewDashboard, onSessionComplete }) {
  const [conversation, setConversation] = useState([]);
  const [showTestPrompt, setShowTestPrompt] = useState(false);
  const [vadState, setVadState] = useState('IDLE');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isServerReady, setIsServerReady] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [outcome, setOutcome] = useState(null);
  const [isEnding, setIsEnding] = useState(false);
  const [sttError, setSttError] = useState(null);
  const [selectedCefr, setSelectedCefr] = useState(null);
  const activeLesson = customLesson || student.currentLesson;

  const MAX_TURNS = 10; 
  const chatEndRef = useRef(null);
  const vadStateRef = useRef('IDLE');
  const conversationRef = useRef([]);
  const isEndingRef = useRef(false);
  const [userTurnCount, setUserTurnCount] = useState(0);
  
  // Audio Playback Refs
  const wsRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);

  // Deepgram Refs
  const deepgramKeyRef = useRef(null);
  const dgConnectionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const microhponeStreamRef = useRef(null);
  const transcriptBufferRef = useRef([]);
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    conversationRef.current = conversation;
    isEndingRef.current = isEnding;
  }, [conversation, isEnding]);

  useEffect(() => {
    // Fetch Deepgram Token
    fetch(`${API_BASE_URL}/auth/deepgram`)
      .then(res => res.json())
      .then(data => {
        deepgramKeyRef.current = data.key;
        setIsServerReady(true);
      })
      .catch(err => {
        console.error("Error fetching deepgram token", err);
        setSttError("Could not connect to the backend server. It might be asleep. Please refresh.");
      });

    return () => {
      stopMedia();
      if (wsRef.current) wsRef.current.close();
      if (dgConnectionRef.current) dgConnectionRef.current.close();
    };
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, vadState]);

  const updateVadState = (newState) => {
    vadStateRef.current = newState;
    setVadState(newState);
  };

  const stopMedia = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (microhponeStreamRef.current) {
      microhponeStreamRef.current.getTracks().forEach(t => t.stop());
      microhponeStreamRef.current = null;
    }
    if (dgConnectionRef.current) {
      dgConnectionRef.current.close();
      dgConnectionRef.current = null;
    }
    if (currentAudioRef.current) { 
      currentAudioRef.current.pause(); 
      currentAudioRef.current = null; 
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  // --- Backend WebSocket (Groq + Cartesia) ---
  const connectBackendWebSocket = () => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/chat_stream';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

        ws.onopen = () => {
      // Send a keep‑alive ping every 30 seconds to avoid idle timeouts
      ws.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket Error:", err);
      setSttError("Backend WebSocket connection failed. The server might have disconnected.");
      updateVadState('ERROR');
    };
    
    ws.onclose = (event) => {
      // Clear ping interval if set
      if (ws.pingInterval) clearInterval(ws.pingInterval);

      // If the session is ending, do not attempt reconnect
      if (isEndingRef.current) {
        setSttError("Session ended. Connection closed.");
        updateVadState('ERROR');
        return;
      }

      // Unexpected close – attempt reconnection with exponential backoff
      const maxRetries = 5;
      const baseDelay = 1000; // 1 second

      const attemptReconnect = (retryCount) => {
        if (retryCount > maxRetries) {
          setSttError("Unable to maintain WebSocket connection. Please try again later.");
          updateVadState('ERROR');
          return;
        }
        const delay = baseDelay * Math.pow(2, retryCount);
        setTimeout(() => {
          console.log(`Reconnecting WebSocket attempt ${retryCount + 1}`);
          connectBackendWebSocket();
        }, delay);
      };

      // Start first reconnection attempt
      attemptReconnect(0);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript') {
        return;
      }
      if (data.audio) {
        audioQueueRef.current.push(data.audio);
        if (!isPlayingRef.current) {
          playNextAudio();
        }
      }
      if (data.type === 'text' || data.text) {
        const aiText = data.text;
        if (!aiText) return;
        setConversation(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            return [...prev.slice(0, -1), { role: 'ai', text: lastMsg.text + aiText }];
          } else {
            return [...prev, { role: 'ai', text: aiText }];
          }
        });
      }
      if (data.type === 'done') {
        if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
          handleTurnEnd();
        }
      }
    };
  };

  const playNextAudio = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      handleTurnEnd();
      return;
    }
    isPlayingRef.current = true;
    updateVadState('AI_SPEAKING');
    
    const audioData = audioQueueRef.current.shift();
    const audioUrl = `data:audio/mp3;base64,${audioData}`;
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;

    audio.onended = () => playNextAudio();
    audio.play().catch(err => {
      console.error("Audio playback error:", err);
      playNextAudio();
    });
  };

  const handleTurnEnd = () => {

    if (userTurnCount >= MAX_TURNS || isEndingRef.current) {
      if (!isEndingRef.current) {
        setIsEnding(true);
        endSession();
      }
    } else {
      updateVadState('LISTENING');
    }
  };

  // --- Deepgram STT ---
  const startDeepgram = async () => {
    stopMedia();
    if (!deepgramKeyRef.current) return;
    
    // Small delay to let the OS fully release the audio device after stopMedia
    await new Promise(resolve => setTimeout(resolve, 300));
    
    let stream = null;
    
    try {
      // Try with audio processing constraints first
      stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
    } catch (firstErr) {
      console.warn("getUserMedia with constraints failed, retrying with basic audio:", firstErr.message);
      try {
        // Fallback: request mic with no constraints
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (secondErr) {
        console.error("Microphone access error:", secondErr);
        if (secondErr.name === 'NotReadableError') {
          setSttError("Could not start the microphone. Try closing other apps that might be using it, or check Windows Settings > Privacy > Microphone.");
        } else if (secondErr.name === 'NotAllowedError') {
          setSttError("Microphone permission denied. Please allow microphone access in your browser settings to practice.");
        } else {
          setSttError("Could not access microphone: " + secondErr.message);
        }
        updateVadState('ERROR');
        return;
      }
    }
    
    microhponeStreamRef.current = stream;

    try {
      const deepgramToken = deepgramKeyRef.current?.trim();
      const wsUrl = `wss://api.deepgram.com/v1/listen?model=general&language=en-US&punctuate=true&interim_results=true&endpointing=2000&utterance_end_ms=3000`;
      const connection = new WebSocket(wsUrl, ['token', deepgramToken]);

      connection.onerror = (err) => {
        console.error("Deepgram Error:", err);
        setSttError("Deepgram connection error. Please check your network.");
        updateVadState('ERROR');
      };

      dgConnectionRef.current = connection;

      connection.onopen = () => {
        setSttError(null);
        updateVadState('LISTENING');
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.addEventListener('dataavailable', event => {
          if (event.data.size > 0 && dgConnectionRef.current?.readyState === WebSocket.OPEN) {
            dgConnectionRef.current.send(event.data);
          }
        });
        mediaRecorder.start(100);
      };

      connection.onmessage = (event) => {
        if (vadStateRef.current !== 'LISTENING') {
          transcriptBufferRef.current = [];
          return false;
        }

        const data = JSON.parse(event.data);
        
        if (data.type === 'Results') {
          const transcript = data.channel.alternatives[0].transcript;
          if (data.is_final && transcript) {
             transcriptBufferRef.current.push(transcript);
          }
          if (data.speech_final) {
             const fullTranscript = transcriptBufferRef.current.join(' ').trim();
             if (fullTranscript) {
               handleSpeechEnd(fullTranscript);
             }
             transcriptBufferRef.current = [];
          }
        } else if (data.type === 'UtteranceEnd') {
             const fullTranscript = transcriptBufferRef.current.join(' ').trim();
             if (fullTranscript) {
               handleSpeechEnd(fullTranscript);
             }
             transcriptBufferRef.current = [];
        }
        
        return false;
      };
    } catch (wsErr) {
      console.error("Deepgram WebSocket setup error:", wsErr);
      setSttError("Failed to connect to speech recognition service.");
      updateVadState('ERROR');
    }
  };

  const startConversation = () => {
    if (isEnding || outcome) return;
    // Reset user turn counter at the start of a new session
    setUserTurnCount(0);
    connectBackendWebSocket();
    setIsSessionActive(true);
    updateVadState('SETTING_UP');
    startDeepgram();
  };

  const handleSpeechEnd = (transcript) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Increment user turn count
    setUserTurnCount(prev => prev + 1);

    const userMessage = { role: 'user', text: trimmedTranscript };
    const nextConversation = [...conversationRef.current, userMessage];
    conversationRef.current = nextConversation;
    setConversation(nextConversation);

    updateVadState('PROCESSING');
    
    // We intentionally leave the microphone and Deepgram connection OPEN 
    // to avoid connection drops and rate limits. The incoming transcripts 
    // will be ignored until vadState is set back to LISTENING.
    
    wsRef.current.send(JSON.stringify({
      history: nextConversation.slice(-5),
      cefrLevel: student.cefrLevel,
      lesson: activeLesson,
      transcript: trimmedTranscript
    }));
  };

  const endSession = async () => {
    if (outcome || isEndingRef.current) return; 
    setIsEnding(true);
    isEndingRef.current = true;
    updateVadState('PROCESSING');
    stopMedia();

    try {
      const feedbackRes = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: conversationRef.current })
      });
      const feedbackData = await feedbackRes.json();
      const feedbackText = feedbackData.feedback || "Good job practicing!";
      setFeedback(feedbackText);

      const saveRes = await fetch(`${API_BASE_URL}/session/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          cefrLevel: student.cefrLevel,
          timestamp: new Date().toISOString(),
          conversation: conversationRef.current,
          feedback: feedbackText,
          lessonId: activeLesson?.lessonId
        })
      });
      const saveData = await saveRes.json();
      setOutcome({ passed: saveData.passed, nextLesson: saveData.nextLesson, levelComplete: saveData.levelComplete });
      if (saveData.levelComplete) setShowTestPrompt(true);
      
      const updatedStudent = {
        ...student,
        practiceStreak: (student.practiceStreak || 0) + 1,
        currentLesson: (!customLesson && saveData.passed) ? (saveData.nextLesson || student.currentLesson) : student.currentLesson,
        levelComplete: saveData.levelComplete || student.levelComplete
      };

      if (onSessionComplete) onSessionComplete(updatedStudent);
      // Reset selected CEFR after session completion
      setSelectedCefr(null);

    } catch (err) {
      console.error(err);
      alert("Error saving session");
    }
  };

  const handleNextLesson = () => onViewDashboard();

  const handleUpdateLevel = async () => {
    if (!selectedCefr) return;
    try {
      const res = await fetch(`${API_BASE_URL}/student/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.studentId, cefrLevel: selectedCefr })
      });
      const data = await res.json();
      
      // Update parent student state so both UI and local storage are synchronized immediately
      if (onSessionComplete && data.student) {
        onSessionComplete(data.student);
      }
      
      if (onViewDashboard) onViewDashboard();
    } catch (e) {
      console.error('Error updating CEFR level:', e);
    }
  };

  const handleRetry = () => {
    setConversation([]);
    setOutcome(null);
    setIsEnding(false);
    setIsSessionActive(false);
    updateVadState('IDLE');
    setFeedback("");
    setUserTurnCount(0);
    if (wsRef.current) wsRef.current.close();
  };

  const renderIndicator = () => {
    if (!isSessionActive) return null;
    switch(vadState) {
      case 'SETTING_UP': return <div className="vad-indicator processing"><Loader2 size={24} className="spin-icon" color="#8b5cf6" /><span>Setting up...</span></div>;
      case 'LISTENING': return <div className="vad-indicator listening"><Mic size={24} color="#8b5cf6" /><span>Your Turn (Speak Now)</span></div>;
      case 'SPEAKING': return <div className="vad-indicator speaking"><div className="pulsing-dot"></div><span>Recording</span></div>;
      case 'PROCESSING': return <div className="vad-indicator processing"><Loader2 size={24} className="spin-icon" color="#ec4899" /><span>Thinking...</span></div>;
      case 'AI_SPEAKING': return <div className="vad-indicator ai-speaking"><Sparkles size={24} color="#eab308" /><span>AI is speaking...</span></div>;
      default: return null;
    }
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {showTestPrompt && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.98)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>New Level Unlocked!</h2>
            <p>You have reached a new CEFR level. Please complete the mandatory assessment.</p>
            <a href="https://example.com/cefR-test" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginBottom: '1rem', color: '#86198f', fontWeight: '600' }}>Take the CEFR Test</a>
            <br />
            <button onClick={() => setShowTestPrompt(false)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}
      {outcome && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: '500px', width: '100%', backgroundColor: 'white', borderRadius: '24px', padding: '2.5rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #f1f5f9' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', backgroundColor: outcome.passed ? '#d1fae5' : '#ffedd5', color: outcome.passed ? '#059669' : '#d97706' }}>
              {outcome.passed ? '🏆' : '🎯'}
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem', color: '#1e293b' }}>
              {outcome.passed ? 'Mission Accomplished!' : 'Mission Incomplete'}
            </h2>
            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: '1.6' }}>
              {outcome.passed ? "Excellent communication! You've successfully achieved the objective for this lesson." : "You're getting closer! The objective wasn't quite met this time, but every conversation makes you stronger."}
            </p>
            <div className="feedback-grid" style={{ textAlign: 'left', marginBottom: '2rem', display: 'grid', gap: '1rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
              {(() => {
                const cleanFeedback = (feedback || "").replace(/#{1,6}\s?/g, '').replace(/>{1,2}\s?/g, '').replace(/\*\*/g, '').replace(/\*/g, '').trim();
                let sections = cleanFeedback.split(/(?=🌟|🛠️|🔥)/);
                if (sections.length <= 1 && cleanFeedback.includes('\n\n')) sections = cleanFeedback.split('\n\n');
                return sections.map((section, idx) => {
                  if (!section.trim()) return null;
                  const isStrength = section.includes('🌟') || idx === 0;
                  const isFix = section.includes('🛠️') || idx === 1;
                  const isChallenge = section.includes('🔥') || idx >= 2;
                  let bgColor = '#f8fafc', borderColor = '#e2e8f0', iconColor = '#64748b';
                  if (isStrength) { bgColor = '#f0fdf4'; borderColor = '#bbf7d0'; iconColor = '#16a34a'; }
                  if (isFix) { bgColor = '#fffbeb'; borderColor = '#fef3c7'; iconColor = '#d97706'; }
                  if (isChallenge) { bgColor = '#eff6ff'; borderColor = '#dbeafe'; iconColor = '#2563eb'; }
                  const title = section.includes(':') ? section.split(':')[0] : (isStrength ? '🌟 Strengths' : (isFix ? '🛠️ Quick Fixes' : '🔥 Next Mission'));
                  const content = section.includes(':') ? section.split(':').slice(1).join(':').trim() : section.trim();
                  return (
                    <div key={idx} style={{ backgroundColor: bgColor, padding: '1.25rem', borderRadius: '16px', border: `1px solid ${borderColor}`, fontSize: '0.95rem', lineHeight: '1.6' }}>
                      <div style={{ fontWeight: '800', color: iconColor, marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
                      <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{content}</div>
                    </div>
                  );
                });
              })()}
            </div>
            {outcome.levelComplete && (
              <>
                <p style={{ color: '#64748b', marginBottom: '1rem' }}>You have completed the current CEFR level! Please take the external CEFR test to determine your new level.</p>
                <a href="https://example.com/cefR-test" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginBottom: '1rem', color: '#86198f', fontWeight: '600' }}>Take the CEFR Test</a>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="newCefr" style={{ marginRight: '0.5rem' }}>Select your new CEFR level:</label>
                  <select id="newCefr" value={selectedCefr || ''} onChange={e => setSelectedCefr(e.target.value)} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="">--Choose--</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                </div>
                <button className="primary-btn" onClick={handleUpdateLevel} disabled={!selectedCefr} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#86198f', color: 'white', fontWeight: '700', border: 'none', cursor: selectedCefr ? 'pointer' : 'not-allowed', marginBottom: '1rem' }}>
                  Update Level
                </button>
              </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {outcome.passed ? (
                <button className="primary-btn" onClick={handleNextLesson} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#86198f', color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  Next Lesson: {outcome.nextLesson?.title || "Level Up"}
                </button>
              ) : (
                <button className="primary-btn" onClick={handleRetry} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#86198f', color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer' }}>Try Again</button>
              )}
              <button className="secondary-btn" onClick={onViewDashboard} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>Return to Dashboard</button>
            </div>
          </div>
        </div>
      )}

      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>{activeLesson?.title || 'Practice Session'}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{activeLesson?.objective || 'Talk naturally with your AI partner.'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: '0.8rem', fontWeight: '700', color: userTurnCount >= MAX_TURNS ? '#ef4444' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
              TURN LIMIT: {userTurnCount} / {MAX_TURNS}
           </div>
           <button onClick={onViewDashboard} style={{ background: '#f1f5f9', color: '#64748b', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>Exit Session</button>
        </div>
      </div>

      <div className="chat-container" style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>
        {!isSessionActive && conversation.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Mic size={32} color="#8b5cf6" />
            </div>
            <h3 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>Ultra-Fast Mode</h3>
            <p style={{ maxWidth: '300px', lineHeight: '1.6', marginBottom: '2rem' }}>Experience sub-second response times powered by Groq, Deepgram, and Cartesia.</p>
            <button 
              onClick={startConversation} 
              disabled={!isServerReady}
              style={{ 
                background: isServerReady ? '#86198f' : '#cbd5e1', 
                color: 'white', 
                padding: '14px 32px', 
                borderRadius: '12px', 
                fontSize: '1.05rem', 
                fontWeight: '700', 
                border: 'none', 
                cursor: isServerReady ? 'pointer' : 'not-allowed', 
                boxShadow: isServerReady ? '0 4px 12px rgba(134, 25, 143, 0.3)' : 'none' 
              }}
            >
              {isServerReady ? 'Start Conversation' : 'Waking up server... (can take 50s)'}
            </button>
          </div>
        )}

        {conversation.map((msg, idx) => {
          if (!msg.text && msg.role === 'ai') {
             return (
               <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem' }}>
                 <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginLeft: '0.5rem' }}>AI Partner</div>
                 <div style={{ padding: '12px 18px', borderRadius: '18px', backgroundColor: '#f1f5f9', borderBottomLeftRadius: '4px' }}>
                   <Loader2 size={16} className="spin-icon" color="#64748b" />
                 </div>
               </div>
             );
          }
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '1rem' }}>
               <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginRight: msg.role === 'user' ? '0.5rem' : '0', marginLeft: msg.role === 'ai' ? '0.5rem' : '0' }}>{msg.role === 'user' ? 'You' : 'AI Partner'}</div>
               <div style={{ padding: '12px 18px', borderRadius: '18px', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '85%', backgroundColor: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9', color: msg.role === 'user' ? 'white' : 'var(--text-main)', borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px', borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '18px', boxShadow: msg.role === 'user' ? '0 4px 12px rgba(158, 40, 145, 0.2)' : 'none' }}>{msg.text}</div>
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {sttError && (
        <div style={{ margin: '1rem 0', padding: '1rem', borderRadius: '14px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
          <strong>Realtime STT failed:</strong> {sttError}
        </div>
      )}

      {isSessionActive && !outcome && (
        <form onSubmit={(e) => {
          e.preventDefault();
          const input = e.target.elements.typedMsg;
          if (input && input.value.trim()) {
            handleSpeechEnd(input.value);
            input.value = '';
          }
        }} style={{ display: 'flex', gap: '0.75rem', margin: '0.5rem 0', width: '100%' }}>
          <input 
            name="typedMsg"
            type="text" 
            placeholder={vadState === 'PROCESSING' ? "AI is thinking..." : "Type your message here..."} 
            disabled={vadState === 'PROCESSING' || isEnding}
            style={{ 
              flex: 1, 
              padding: '12px 18px', 
              borderRadius: '12px', 
              border: '1px solid #cbd5e1', 
              outline: 'none',
              fontSize: '0.95rem'
            }} 
          />
          <button 
            type="submit" 
            disabled={vadState === 'PROCESSING' || isEnding}
            style={{ 
              padding: '12px 20px', 
              background: '#9E2891', 
              color: 'white', 
              border: 'none', 
              borderRadius: '12px', 
              fontWeight: '700', 
              cursor: 'pointer' 
            }}
          >
            Send
          </button>
        </form>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
        <div style={{ width: '120px' }}>
          {isSessionActive && conversation.length > 0 && !outcome && (
            <button onClick={endSession} disabled={vadState === 'PROCESSING'} style={{ background: '#f1f5f9', color: '#64748b', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>End Early</button>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {renderIndicator()}
        </div>
        <div style={{ width: '120px', textAlign: 'right' }}></div>
      </div>
    </div>
  );
}

export default Session;
