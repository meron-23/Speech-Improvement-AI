import { useState, useRef, useEffect } from 'react';
import hark from 'hark';
import API_BASE_URL from './config';
import { ArrowLeft, CheckCircle2, HelpCircle, Lightbulb, Mic, Loader2, Sparkles } from 'lucide-react';

function Session({ student, customLesson, onViewDashboard, onSessionComplete }) {
  const [conversation, setConversation] = useState([]);
  const [showTestPrompt, setShowTestPrompt] = useState(false);
  const [vadState, setVadState] = useState('IDLE');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isServerReady, setIsServerReady] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackReport, setFeedbackReport] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [isEnding, setIsEnding] = useState(false);
  const [sttError, setSttError] = useState(null);
  const [selectedCefr, setSelectedCefr] = useState(null);
  const activeLesson = customLesson || student.currentLesson;

  const MAX_TURNS = 10; 
  const RESULT_METRICS = ['Grammar', 'Accuracy'];
  const METRIC_COLORS = {
    Grammar: '#10b981',
    Accuracy: '#8b5cf6'
  };
  const LISTENING_DELAY_MS = 300;
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
  const audioChunkBufferRef = useRef([]);
  const headerChunkRef = useRef(null);
  const speechFinalRef = useRef(false);
  const speechActiveRef = useRef(false);

  useEffect(() => {
    conversationRef.current = conversation;
    isEndingRef.current = isEnding;
  }, [conversation, isEnding]);

  useEffect(() => {
    setIsServerReady(true);

    return () => {
      stopMedia();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation, vadState]);

  const updateVadState = (newState) => {
    console.log(`[VAD STATE] ${vadStateRef.current} → ${newState}`);
    vadStateRef.current = newState;
    setVadState(newState);
  };

  function stopMicAndSTT() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (microhponeStreamRef.current) {
      if (microhponeStreamRef.current.speechEvents) {
        microhponeStreamRef.current.speechEvents.stop();
      }
      microhponeStreamRef.current.getTracks().forEach(t => t.stop());
      microhponeStreamRef.current = null;
    }
  }

  function stopAudioPlayback() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }

  function stopMedia() {
    stopMicAndSTT();
    stopAudioPlayback();
  }

  // --- Backend WebSocket (Groq + Cartesia) ---
  const connectBackendWebSocket = () => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/chat_stream';
    console.log("[BACKEND WS] Attempting to connect to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[BACKEND WS] Connected!");
      // Send a keep‑alive ping every 30 seconds to avoid idle timeouts
      ws.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      
      // If this is a new session, ask the AI to start the conversation
      if (conversationRef.current.length === 0) {
        updateVadState('PROCESSING');
        ws.send(JSON.stringify({
          type: 'start',
          history: [],
          cefrLevel: student?.cefrLevel || 'B1',
          lesson: activeLesson
        }));
      }
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
        console.log("[BACKEND WS] Audio received. Size:", data.audio.length);
        audioQueueRef.current.push(data.audio);
        if (!isPlayingRef.current) {
          playNextAudio();
        }
      }
      if (data.type === 'text' || data.text) {
        const aiText = data.text;
        console.log("[BACKEND WS] Text received:", aiText);
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
        console.log("[BACKEND WS] DONE signal received. Audio queue length:", audioQueueRef.current.length, "isPlaying:", isPlayingRef.current);
        if (audioQueueRef.current.length === 0 && !isPlayingRef.current) {
          // No audio was received (Google Translate TTS may have failed).
          // Skip audio gracefully and proceed to the next turn.
          console.log("[BACKEND WS] No audio in queue, calling handleTurnEnd");
          handleTurnEnd();
        }
      }
    };
  };

  const playNextAudio = () => {
    console.log("[AUDIO] playNextAudio called. Queue length:", audioQueueRef.current.length);
    if (audioQueueRef.current.length === 0) {
      console.log("[AUDIO] No more audio in queue. Calling handleTurnEnd");
      isPlayingRef.current = false;
      handleTurnEnd();
      return;
    }
    isPlayingRef.current = true;
    updateVadState('AI_SPEAKING');
    
    const audioData = audioQueueRef.current.shift();
    const audioUrl = `data:audio/mp3;base64,${audioData}`;
    console.log("[AUDIO] Creating audio element from base64. Data length:", audioData.length);
    const audio = new Audio(audioUrl);
    currentAudioRef.current = audio;

    audio.onended = () => {
      console.log("[AUDIO] Audio ended, playing next");
      playNextAudio();
    };
    audio.play().catch(err => {
      console.error("[AUDIO] Playback error:", err);
      playNextAudio();
    });
  };

  const handleTurnEnd = () => {
    console.log("[TURN END] Checking end conditions. userTurnCount:", userTurnCount, "MAX_TURNS:", MAX_TURNS, "isEnding:", isEndingRef.current);

    if (userTurnCount >= MAX_TURNS || isEndingRef.current) {
      if (!isEndingRef.current) {
        console.log("[TURN END] Ending session - max turns reached or session ending");
        setIsEnding(true);
        endSession();
      }
    } else {
      console.log("[TURN END] Returning to LISTENING state after delay:", LISTENING_DELAY_MS, "ms");
      setTimeout(() => {
        if (!isEndingRef.current && vadStateRef.current !== 'ERROR') {
          startVoiceCapture();
        }
      }, LISTENING_DELAY_MS);
    }
  };

  // --- Gemini STT Voice Capture (Turn-based MediaRecorder) ---
  const startVoiceCapture = async () => {
    console.log("[VOICE] Starting voice capture...");
    
    // Stop silence timer and old MediaRecorder if any
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Clear old chunks for the new turn
    audioChunkBufferRef.current = [];
    
    let stream = microhponeStreamRef.current;
    if (!stream) {
      // Small delay to let the OS fully release the audio device after stopMicAndSTT
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        microhponeStreamRef.current = stream;
        
        console.log("[VOICE] Setting up Hark...");
        // -50dB is standard and stable threshold
        const speechEvents = hark(stream, { threshold: -50, interval: 100 });
        
        speechEvents.on('speaking', () => {
          console.log("[HARK] Speaking detected. State:", vadStateRef.current);
          if (vadStateRef.current === 'LISTENING') {
            updateVadState('SPEAKING');
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
          }
        });

        speechEvents.on('stopped_speaking', () => {
          console.log("[HARK] Stopped speaking. State:", vadStateRef.current);
          if (vadStateRef.current === 'SPEAKING' || vadStateRef.current === 'LISTENING') {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (vadStateRef.current === 'SPEAKING') {
                const chunks = audioChunkBufferRef.current.slice();
                
                if (chunks.length > 0) {
                  updateVadState('PROCESSING'); 
                  
                  // Stop recorder cleanly
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    mediaRecorderRef.current.stop();
                  }
                  
                  const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                  console.log("[VOICE] Sending audio to Gemini STT. Chunk count:", chunks.length);
                  const blob = new Blob(chunks, { type: mimeType });
                  const formData = new FormData();
                  formData.append('audio', blob, 'speech.webm');

                  fetch(`${API_BASE_URL}/stt`, { method: 'POST', body: formData })
                    .then(res => res.json())
                    .then(data => {
                      console.log("[VOICE] STT Response:", data);
                      const transcript = data.text?.trim();
                      if (transcript) {
                        handleSpeechEnd(transcript);
                      } else {
                        console.log("[VOICE] Empty transcript from STT");
                        if (!isEndingRef.current && vadStateRef.current !== 'AI_SPEAKING') {
                          startVoiceCapture();
                        }
                      }
                    })
                    .catch(err => {
                      console.error("[VOICE] STT Error:", err);
                      if (!isEndingRef.current && vadStateRef.current !== 'AI_SPEAKING') {
                        startVoiceCapture();
                      }
                    });
                } else {
                  console.log("[VOICE] No chunks to send, returning to LISTENING");
                  updateVadState('LISTENING');
                }
              }
              silenceTimerRef.current = null;
            }, 800);
          }
        });

        microhponeStreamRef.current.speechEvents = speechEvents;
      } catch (err) {
        console.error("Microphone access error:", err);
        setSttError("Could not access microphone.");
        updateVadState('ERROR');
        return;
      }
    }

    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) {
          audioChunkBufferRef.current.push(event.data);
        }
      });
      mediaRecorder.start(100);
      console.log("[VOICE] New MediaRecorder started for this turn.");
      updateVadState('LISTENING');
    } catch (err) {
      console.error("[VOICE] MediaRecorder start error:", err);
      setSttError("Failed to start speech recording.");
      updateVadState('ERROR');
    }
  };

  const startConversation = () => {
    console.log("[START CONVERSATION] Starting practice session");
    if (isEnding || outcome) {
      console.log("[START CONVERSATION] Session already ending or completed");
      return;
    }
    // Reset user turn counter at the start of a new session
    setUserTurnCount(0);
    connectBackendWebSocket();
    setIsSessionActive(true);
    updateVadState('SETTING_UP');
    startVoiceCapture();
  };

  const handleSpeechEnd = (transcript) => {
    console.log("[SPEECH END] Received transcript:", transcript);
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      console.log("[SPEECH END] Empty transcript after trim");
      return;
    }
    if (!wsRef.current) {
      console.error("[SPEECH END] Backend WebSocket not initialized");
      return;
    }
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("[SPEECH END] Backend WebSocket not OPEN. State:", wsRef.current.readyState);
      return;
    }

    // Increment user turn count
    setUserTurnCount(prev => prev + 1);

    const userMessage = { role: 'user', text: trimmedTranscript };
    const nextConversation = [...conversationRef.current, userMessage];
    conversationRef.current = nextConversation;
    setConversation(nextConversation);

    console.log("[SPEECH END] Sending to backend. Turn count:", userTurnCount + 1);
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
        body: JSON.stringify({
          conversation: conversationRef.current,
          cefrLevel: student.cefrLevel,
          lesson: activeLesson
        })
      });
      const feedbackData = await feedbackRes.json();
      const report = feedbackData.report || parseFeedbackReport(feedbackData.feedback);
      const feedbackText = feedbackData.feedback || JSON.stringify(report || {});
      setFeedbackReport(report);
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
    setFeedbackReport(null);
    setSelectedMetric(null);
    updateVadState('IDLE');
    setFeedback("");
    setUserTurnCount(0);
    if (wsRef.current) wsRef.current.close();
  };

  const parseFeedbackReport = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };

  const getReport = () => {
    const report = feedbackReport || parseFeedbackReport(feedback);
    if (report?.metrics?.length) {
      const visibleMetrics = report.metrics.filter(metric => RESULT_METRICS.includes(metric.name));
      if (visibleMetrics.length) {
        return {
          ...report,
          metrics: visibleMetrics
        };
      }
    }

    const answers = conversationRef.current.filter(msg => msg.role === 'user');
    const percent = answers.length ? 100 : 0;
    return {
      summary: "Here is your assessment summary based on the answers you completed.",
      metrics: RESULT_METRICS.map(name => ({
        name,
        percent,
        totalQuestions: answers.length,
        correct: answers.length,
        missing: 0,
        review: answers.map(msg => ({
          answer: msg.text,
          status: 'correct',
          score: 1,
          issue: '',
          suggestion: 'Nice clear response.'
        })),
        quickTip: name === 'Grammar'
          ? 'Use full basic patterns: subject + verb + object.'
          : 'Answer the question directly and include the key details.'
      }))
    };
  };

  const getMetricByName = (name) => getReport().metrics.find(metric => metric.name === name);

  const renderScoreBar = (metric) => {
    const color = METRIC_COLORS[metric.name] || '#9E2891';
    return (
      <div className="result-card-bar">
        <div className="result-card-fill" style={{ width: `${Math.max(0, Math.min(metric.percent, 100))}%`, background: color }} />
      </div>
    );
  };

  const renderResultsOverview = () => {
    const report = getReport();
    const totalQuestions = report.metrics[0]?.totalQuestions || 0;
    return (
      <div className="assessment-shell">
        <div className="assessment-content">
          <div className="session-result-banner" style={{ marginBottom: '1rem', padding: '1rem 1.25rem', borderRadius: '16px', background: outcome?.passed ? '#ecfdf5' : '#f8d7da', border: `1px solid ${outcome?.passed ? '#10b981' : '#ef4444'}`, color: outcome?.passed ? '#065f46' : '#991b1b' }}>
            <strong style={{ display: 'block', fontSize: '1.05rem', marginBottom: '0.25rem' }}>{outcome?.passed ? 'Session passed!' : 'Session not passed yet'}</strong>
            <span>{outcome?.passed ? 'Great work — you met the lesson objective and can continue to the next lesson.' : 'Keep practicing this lesson until you satisfy the objective.'}</span>
          </div>

          <div className="assessment-heading">
            <h2>Your results are ready</h2>
            <p>{report.summary || "Here is your assessment summary based on the answers you completed."}</p>
          </div>

          <div className="result-summary-strip">
            <span>Total answers</span>
            <strong>{totalQuestions}</strong>
          </div>

          <div className="result-metric-grid">
            {report.metrics.map(metric => (
              <div className="result-metric-card" key={metric.name}>
                <div className="result-card-header">
                  <span>{metric.name}</span>
                  <strong>{metric.percent}%</strong>
                </div>
                {renderScoreBar(metric)}
                <button className="detail-button" type="button" onClick={() => setSelectedMetric(metric.name)}>
                  View Detail
                </button>
              </div>
            ))}
          </div>

          <div className="result-actions">
            {outcome?.passed ? (
              <button className="primary-result-btn" type="button" onClick={handleNextLesson}>
                Next Lesson{outcome.nextLesson?.title ? `: ${outcome.nextLesson.title}` : ''}
              </button>
            ) : (
              <button className="primary-result-btn" type="button" onClick={handleRetry}>
                Practice Again
              </button>
            )}
            <button className="secondary-result-btn" type="button" onClick={() => setSelectedMetric(report.metrics[0]?.name)}>
              View Result Details
            </button>
            <button className="text-result-btn" type="button" onClick={onViewDashboard}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMetricDetail = () => {
    const metric = getMetricByName(selectedMetric) || getReport().metrics[0];
    if (!metric) return renderResultsOverview();
    const color = METRIC_COLORS[metric.name] || '#9E2891';

    return (
      <div className="assessment-shell">
        <div className="detail-top">
          <button className="back-icon-btn" type="button" onClick={() => setSelectedMetric(null)} aria-label="Back to results">
            <ArrowLeft size={20} />
          </button>
          <span>Result details</span>
        </div>
        <div className="assessment-content detail">
          <h2 className="metric-title" style={{ color }}>{metric.name}</h2>
          <div className="score-ring" style={{ background: `conic-gradient(${color} ${metric.percent * 3.6}deg, #eef2f7 0deg)` }}>
            <div className="score-ring-inner">{metric.percent}%</div>
          </div>
          <p className="metric-note">
            {metric.percent >= 90
              ? "Strong work across the answers for this metric."
              : `This score is based on ${metric.totalQuestions} answers, with partial credit for understandable responses.`}
          </p>

          <div className="review-panel">
            <h3>Conversation Review</h3>
            <div className="review-list">
              {(metric.review || []).map((item, idx) => {
                const isCorrect = item.status === 'correct';
                const isPartial = item.status === 'partial';
                return (
                  <div className="review-item" key={`${metric.name}-${idx}`}>
                    <div className={`review-status ${isCorrect ? 'correct' : isPartial ? 'partial' : 'missing'}`}>
                      {isCorrect ? <CheckCircle2 size={14} /> : <HelpCircle size={14} />}
                    </div>
                    <div>
                      <p>{item.answer || `Answer ${idx + 1}`}</p>
                      <span>{isCorrect
                        ? 'Strong answer'
                        : isPartial
                          ? item.issue || 'Partly correct'
                          : item.issue || 'Needs improvement'}{!isCorrect && item.suggestion ? ` Suggestion: ${item.suggestion}` : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="summary-panel">
            <h3>Summary</h3>
            <div><span>Total answers</span><strong>{metric.totalQuestions}</strong></div>
            <div><span>Score earned</span><strong className="positive">{metric.correct}</strong></div>
            <div><span>Score missed</span><strong className="negative">{metric.missing}</strong></div>
          </div>

          <div className="quick-tip">
            <Lightbulb size={18} />
            <div>
              <strong>Quick Tip</strong>
              <span>{metric.quickTip}</span>
            </div>
          </div>

          <div className="detail-actions">
            <button className="secondary-result-btn" type="button" onClick={() => {
              const metrics = getReport().metrics;
              const currentIndex = metrics.findIndex(item => item.name === metric.name);
              const nextMetric = metrics[currentIndex + 1];
              if (nextMetric) setSelectedMetric(nextMetric.name);
              else setSelectedMetric(null);
            }}>
              Next Metric
            </button>
            <button className="primary-result-btn" type="button" onClick={handleRetry}>
              Practice Again
            </button>
          </div>
        </div>
      </div>
    );
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
        <div className="assessment-overlay">
          {selectedMetric ? renderMetricDetail() : renderResultsOverview()}
          <div className="assessment-level-complete">
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
