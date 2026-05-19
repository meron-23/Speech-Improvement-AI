import React, { useState, useRef, useEffect } from 'react';
import API_BASE_URL from './config';
import { Mic, Loader2, Sparkles, AlertCircle } from 'lucide-react';

function Session({ student, onViewDashboard, onSessionComplete }) {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [vadState, setVadState] = useState('IDLE'); // IDLE, LISTENING, SPEAKING, PROCESSING, AI_SPEAKING
  const [conversation, setConversation] = useState([]); // { role: 'user' | 'ai', text: string }
  const [feedback, setFeedback] = useState("");
  const [outcome, setOutcome] = useState(null); 
  const [isEnding, setIsEnding] = useState(false);

  const MAX_TURNS = 10; 
  const chatEndRef = useRef(null);
  const vadStateRef = useRef('IDLE');
  const conversationRef = useRef([]);
  const isEndingRef = useRef(false);
  
  // WebSocket and Streaming Refs
  const wsRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef(null);
  const isAiTurnDoneRef = useRef(true);

  const recognitionRef = useRef(null);

  useEffect(() => {
    conversationRef.current = conversation;
    isEndingRef.current = isEnding;
  }, [conversation, isEnding]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
         console.log("[SpeechRecognition] onstart fired");
         updateVadState('LISTENING');
      };
      
      recognition.onspeechstart = () => {
         console.log("[SpeechRecognition] onspeechstart fired");
         if (vadStateRef.current === 'LISTENING') {
            updateVadState('SPEAKING');
         }
      };
      
      recognition.onresult = (event) => {
         for (let i = event.resultIndex; i < event.results.length; ++i) {
           if (event.results[i].isFinal) {
             const transcript = event.results[i][0].transcript;
             console.log("[SpeechRecognition] Final Transcript:", transcript);
             handleSpeechEnd(transcript);
           } else {
             // Optional: could show interim results on screen
             if (vadStateRef.current === 'LISTENING') {
                updateVadState('SPEAKING');
             }
           }
         }
      };
      
      recognition.onend = () => {
         console.log("[SpeechRecognition] onend fired, vadState is", vadStateRef.current);
         // Only restart if we intentionally want to keep listening
         if (vadStateRef.current === 'LISTENING') {
             setTimeout(() => {
                 try { recognition.start(); } catch (e) { console.error("Error restarting:", e); }
             }, 500);
         }
      };
      
      recognition.onerror = (e) => {
         console.error("[SpeechRecognition] onerror fired:", e.error, e.message);
         if (e.error === 'not-allowed') {
            alert("Microphone access denied. Please allow it in your browser.");
            updateVadState('IDLE');
            setIsSessionActive(false);
         }
         // no-speech usually triggers onend right after, which will handle the restart
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn("Browser Native STT is not supported in this browser.");
    }

    // Cleanup on unmount
    return () => {
      stopMedia();
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateVadState = (newState) => {
    vadStateRef.current = newState;
    setVadState(newState);
  };

  const stopMedia = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch(e) {}
    }
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  };

  const connectWebSocket = () => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/chat_stream';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => console.log("WebSocket connected");
    ws.onerror = (err) => console.error("WebSocket error", err);
    ws.onclose = () => console.log("WebSocket closed");
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'transcript') {
        setConversation(prev => [...prev, { role: 'user', text: data.text }]);
        setConversation(prev => [...prev, { role: 'ai', text: '' }]);
        setTimeout(scrollToBottom, 100);
      } else if (data.type === 'audio') {
        setConversation(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'ai') {
            updated[updated.length - 1] = {
              ...lastMsg,
              text: lastMsg.text + (lastMsg.text && data.text ? " " : "") + data.text
            };
          }
          return updated;
        });
        setTimeout(scrollToBottom, 100);
        queueAudio(`data:audio/wav;base64,${data.audio}`);
      } else if (data.type === 'done') {
        isAiTurnDoneRef.current = true;
        // Check if queue is already empty, meaning playback finished before generation
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
           handleTurnEnd();
        }
      }
    };
    wsRef.current = ws;
  };

  const queueAudio = (audioUrl) => {
    audioQueueRef.current.push(audioUrl);
    playNextAudio();
  };

  const playNextAudio = () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    
    isPlayingRef.current = true;
    updateVadState('AI_SPEAKING');
    
    const audioUrl = audioQueueRef.current.shift();
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;
    
    audio.onended = () => {
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      if (audioQueueRef.current.length > 0) {
        playNextAudio();
      } else if (isAiTurnDoneRef.current) {
        handleTurnEnd();
      } else {
        // Wait for more audio to arrive
        updateVadState('PROCESSING');
      }
    };
    
    audio.play().catch(e => {
      console.error("Audio playback error:", e);
      isPlayingRef.current = false;
      currentAudioRef.current = null;
      playNextAudio(); // skip to next
    });
  };

  const handleTurnEnd = () => {
    if (conversationRef.current.length >= MAX_TURNS || isEndingRef.current) {
      if (!isEndingRef.current) {
        setIsEnding(true);
        endSession();
      }
    } else {
      updateVadState('SETTING_UP');
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch(e) {}
      }
    }
  };

  const startConversation = () => {
    if (isEnding || outcome) return;
    
    if (!recognitionRef.current) {
      alert("Browser Native STT is not supported in your browser. Please use Chrome or Edge.");
      return;
    }

    connectWebSocket();
    setIsSessionActive(true);
    updateVadState('SETTING_UP');
    try { recognitionRef.current.start(); } catch(e) {}
  };

  const handleSpeechEnd = async (transcript) => {
    if (!transcript || transcript.trim().length === 0) {
       updateVadState('LISTENING');
       try { recognitionRef.current.start(); } catch(e) {}
       return;
    }
    
    // Ensure WS is connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
       console.error("WebSocket not connected!");
       updateVadState('LISTENING');
       try { recognitionRef.current.start(); } catch(e) {}
       return;
    }

    isAiTurnDoneRef.current = false;
    updateVadState('PROCESSING');
    
    // Send metadata JSON
    wsRef.current.send(JSON.stringify({
      history: conversationRef.current.slice(-5),
      cefrLevel: student.cefrLevel,
      lesson: student.currentLesson,
      transcript: transcript
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
          lessonId: student.currentLesson?.lessonId
        })
      });
      const saveData = await saveRes.json();
      setOutcome({ passed: saveData.passed, nextLesson: saveData.nextLesson });
      
      const updatedStudent = {
        ...student,
        practiceStreak: (student.practiceStreak || 0) + 1,
        currentLesson: saveData.passed ? (saveData.nextLesson || student.currentLesson) : student.currentLesson
      };

      if (onSessionComplete) onSessionComplete(updatedStudent);

    } catch (err) {
      console.error(err);
      alert("Error saving session");
    }
  };

  const handleNextLesson = () => {
    onViewDashboard();
  };

  const handleRetry = () => {
    setConversation([]);
    setOutcome(null);
    setIsEnding(false);
    setIsSessionActive(false);
    updateVadState('IDLE');
    setFeedback("");
    if (wsRef.current) wsRef.current.close();
  };

  const renderIndicator = () => {
    if (!isSessionActive) return null;
    
    switch(vadState) {
      case 'SETTING_UP':
        return (
          <div className="vad-indicator processing">
             <Loader2 size={24} className="spin-icon" color="#8b5cf6" />
             <span>Setting up...</span>
          </div>
        );
      case 'LISTENING':
        return (
          <div className="vad-indicator listening">
             <Mic size={24} color="#8b5cf6" />
             <span>Your Turn (Speak Now)</span>
          </div>
        );
      case 'SPEAKING':
        return (
          <div className="vad-indicator speaking">
             <div className="pulsing-dot"></div>
             <span>Recording</span>
          </div>
        );
      case 'PROCESSING':
        return (
          <div className="vad-indicator processing">
             <Loader2 size={24} className="spin-icon" color="#ec4899" />
             <span>Thinking...</span>
          </div>
        );
      case 'AI_SPEAKING':
        return (
          <div className="vad-indicator ai-speaking">
             <Sparkles size={24} color="#eab308" />
             <span>AI is speaking...</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* Mission Outcome Overlay */}
      {outcome && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(255,255,255,0.95)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div style={{
            maxWidth: '500px', width: '100%', backgroundColor: 'white',
            borderRadius: '24px', padding: '2.5rem', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%', margin: '0 auto 1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
              backgroundColor: outcome.passed ? '#d1fae5' : '#ffedd5',
              color: outcome.passed ? '#059669' : '#d97706'
            }}>
              {outcome.passed ? '🏆' : '🎯'}
            </div>
            
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem', color: '#1e293b' }}>
              {outcome.passed ? 'Mission Accomplished!' : 'Mission Incomplete'}
            </h2>
            
            <p style={{ color: '#64748b', marginBottom: '2rem', lineHeight: '1.6' }}>
              {outcome.passed 
                ? "Excellent communication! You've successfully achieved the objective for this lesson."
                : "You're getting closer! The objective wasn't quite met this time, but every conversation makes you stronger."}
            </p>

            <div className="feedback-grid" style={{ 
              textAlign: 'left', 
              marginBottom: '2rem', 
              display: 'grid', 
              gap: '1rem',
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {(() => {
                const cleanFeedback = (feedback || "")
                  .replace(/#{1,6}\s?/g, '') 
                  .replace(/>{1,2}\s?/g, '') 
                  .replace(/\*\*/g, '')      
                  .replace(/\*/g, '')        
                  .trim();

                let sections = cleanFeedback.split(/(?=🌟|🛠️|🔥)/);
                if (sections.length <= 1 && cleanFeedback.includes('\n\n')) {
                  sections = cleanFeedback.split('\n\n');
                }

                return sections.map((section, idx) => {
                  if (!section.trim()) return null;
                  const isStrength = section.includes('🌟') || idx === 0;
                  const isFix = section.includes('🛠️') || idx === 1;
                  const isChallenge = section.includes('🔥') || idx >= 2;
                  
                  let bgColor = '#f8fafc';
                  let borderColor = '#e2e8f0';
                  let iconColor = '#64748b';
                  
                  if (isStrength) { bgColor = '#f0fdf4'; borderColor = '#bbf7d0'; iconColor = '#16a34a'; }
                  if (isFix) { bgColor = '#fffbeb'; borderColor = '#fef3c7'; iconColor = '#d97706'; }
                  if (isChallenge) { bgColor = '#eff6ff'; borderColor = '#dbeafe'; iconColor = '#2563eb'; }

                  const title = section.includes(':') ? section.split(':')[0] : (isStrength ? '🌟 Strengths' : (isFix ? '🛠️ Quick Fixes' : '🔥 Next Mission'));
                  const content = section.includes(':') ? section.split(':').slice(1).join(':').trim() : section.trim();

                  return (
                    <div key={idx} style={{ 
                      backgroundColor: bgColor, 
                      padding: '1.25rem', 
                      borderRadius: '16px', 
                      border: `1px solid ${borderColor}`,
                      fontSize: '0.95rem',
                      lineHeight: '1.6'
                    }}>
                      <div style={{ fontWeight: '800', color: iconColor, marginBottom: '0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {title}
                      </div>
                      <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>
                        {content}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {outcome.passed ? (
                <button className="primary-btn" onClick={handleNextLesson} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#86198f', color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  Next Lesson: {outcome.nextLesson?.title || "Level Up"}
                </button>
              ) : (
                <button className="primary-btn" onClick={handleRetry} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#86198f', color: 'white', fontWeight: '700', border: 'none', cursor: 'pointer' }}>
                  Try Again
                </button>
              )}
              <button className="secondary-btn" onClick={onViewDashboard} style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '12px', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}>
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>{student.currentLesson?.title || 'Practice Session'}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{student.currentLesson?.objective || 'Talk naturally with your AI partner.'}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: '0.8rem', fontWeight: '700', color: conversation.length >= MAX_TURNS ? '#ef4444' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
              TURN LIMIT: {conversation.length} / {MAX_TURNS}
           </div>
           <button onClick={onViewDashboard} style={{ background: '#f1f5f9', color: '#64748b', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>
             Exit Session
           </button>
        </div>
      </div>

      <div className="chat-container" style={{ position: 'relative' }}>
        {!isSessionActive && conversation.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Mic size={32} color="#8b5cf6" />
            </div>
            <h3 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>Hands-Free Mode</h3>
            <p style={{ maxWidth: '300px', lineHeight: '1.6', marginBottom: '2rem' }}>We will automatically detect when you start and stop speaking.</p>
            <button 
              onClick={startConversation}
              style={{ background: '#86198f', color: 'white', padding: '14px 32px', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '700', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(134, 25, 143, 0.3)' }}
            >
              Start Conversation
            </button>
          </div>
        )}

        {conversation.map((msg, idx) => {
          if (!msg.text && msg.role === 'ai') {
             // Show a typing indicator if text is empty
             return (
               <div key={idx} style={{ 
                 display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem'
               }}>
                 <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginLeft: '0.5rem' }}>
                   AI Partner
                 </div>
                 <div style={{ padding: '12px 18px', borderRadius: '18px', backgroundColor: '#f1f5f9', borderBottomLeftRadius: '4px' }}>
                   <Loader2 size={16} className="spin-icon" color="#64748b" />
                 </div>
               </div>
             );
          }
          return (
            <div key={idx} style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '1rem'
            }}>
               <div style={{ 
                 fontSize: '0.7rem', 
                 fontWeight: '800', 
                 textTransform: 'uppercase', 
                 color: 'var(--text-muted)', 
                 marginBottom: '0.25rem',
                 marginRight: msg.role === 'user' ? '0.5rem' : '0',
                 marginLeft: msg.role === 'ai' ? '0.5rem' : '0'
               }}>
                 {msg.role === 'user' ? 'You' : 'AI Partner'}
               </div>
               <div style={{ 
                 padding: '12px 18px',
                 borderRadius: '18px',
                 fontSize: '0.95rem',
                 lineHeight: '1.5',
                 maxWidth: '85%',
                 backgroundColor: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9',
                 color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                 borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px',
                 borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '18px',
                 boxShadow: msg.role === 'user' ? '0 4px 12px rgba(158, 40, 145, 0.2)' : 'none'
               }}>
                 {msg.text}
               </div>
            </div>
          )
        })}
        
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
        <div style={{ width: '120px' }}>
          {isSessionActive && conversation.length > 0 && !outcome && (
            <button onClick={endSession} disabled={vadState === 'PROCESSING'} style={{ background: '#f1f5f9', color: '#64748b', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>
              End Early
            </button>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {renderIndicator()}
        </div>

        <div style={{ width: '120px', textAlign: 'right' }}>
           {/* Placeholder for symmetry */}
        </div>
      </div>
    </div>
  );
}

export default Session;
