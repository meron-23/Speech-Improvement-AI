import { useState, useRef, useEffect } from 'react';
import API_BASE_URL from './config';
import { AM, EN } from './Layout';
import { ArrowLeft, CheckCircle2, HelpCircle, Lightbulb, Mic, Loader2, Sparkles } from 'lucide-react';
import hark from 'hark';

function Session({ student, customLesson, amharic, onViewDashboard, onSessionComplete }) {
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
  const T = amharic ? AM : EN;
  const METRIC_COLORS = {
    Grammar: '#10b981',
    Accuracy: '#8b5cf6'
  };
  const chatEndRef = useRef(null);
  const vadStateRef = useRef('IDLE');
  const conversationRef = useRef([]);
  const isEndingRef = useRef(false);
  const [userTurnCount, setUserTurnCount] = useState(0);
  const userTurnCountRef = useRef(0);

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
  // Use English-only Deepgram model for connection stability.
  // Non-English input is handled by the LLM system prompt (nudging the user to speak English).
  const deepgramLanguageRef = useRef('en-US');
  // Track reconnection attempts for Deepgram
  const deepgramRetryCountRef = useRef(0);
  // Buffer raw audio chunks during LISTENING to use as fallback STT for non-English speech
  const audioChunkBufferRef = useRef([]);

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
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
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
          // No audio was received (Google Translate TTS may have failed).
          // Skip audio gracefully and proceed to the next turn.
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
    audio.onerror = () => {
      console.error("Audio playback error event triggered");
      playNextAudio();
    };
    audio.play().catch(err => {
      console.error("Audio playback error:", err);
      playNextAudio();
    });
  };

  const handleTurnEnd = () => {

    if (userTurnCountRef.current >= MAX_TURNS || isEndingRef.current) {
      if (!isEndingRef.current) {
        setIsEnding(true);
        endSession();
      }
    } else {
      updateVadState('LISTENING');
      startVoiceCapture();
    }
  };

  // --- Gemini STT and Client-Side VAD via Hark ---
  const startVoiceCapture = async () => {
    stopMicAndSTT();

    // Small delay to let the OS fully release the audio device after stopMicAndSTT
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
      audioChunkBufferRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunkBufferRef.current.push(event.data);
        }
      };
      mediaRecorder.start(100);

      // Set up Hark VAD silence detection
      const speechEvents = hark(stream, { threshold: -50, interval: 100 });
      
      speechEvents.on('speaking', () => {
        if (vadStateRef.current === 'LISTENING') {
          updateVadState('SPEAKING');
        }
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      });

      speechEvents.on('stopped_speaking', () => {
        if (vadStateRef.current === 'SPEAKING' || vadStateRef.current === 'LISTENING') {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          
          silenceTimerRef.current = setTimeout(() => {
            if (vadStateRef.current === 'SPEAKING') {
              const chunks = audioChunkBufferRef.current.slice();
              audioChunkBufferRef.current = [];

              if (chunks.length > 0) {
                updateVadState('PROCESSING');

                // Stop recorder and tracks cleanly
                if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                  mediaRecorderRef.current.stop();
                }
                if (microhponeStreamRef.current) {
                  microhponeStreamRef.current.getTracks().forEach(t => t.stop());
                  microhponeStreamRef.current = null;
                }
                if (speechEvents) {
                  speechEvents.stop();
                }

                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const blob = new Blob(chunks, { type: mimeType });
                const formData = new FormData();
                formData.append('audio', blob, 'speech.webm');

                fetch(`${API_BASE_URL}/stt`, { method: 'POST', body: formData })
                  .then(res => res.json())
                  .then(data => {
                    const transcript = data.text?.trim();
                    if (transcript) {
                      handleSpeechEnd(transcript);
                    } else {
                      if (!isEndingRef.current && vadStateRef.current !== 'AI_SPEAKING') {
                        startVoiceCapture();
                      }
                    }
                  })
                  .catch(err => {
                    console.error("STT Error:", err);
                    if (!isEndingRef.current && vadStateRef.current !== 'AI_SPEAKING') {
                      startVoiceCapture();
                    }
                  });
              } else {
                updateVadState('LISTENING');
              }
            }
            silenceTimerRef.current = null;
          }, 800);
        }
      });

      stream.speechEvents = speechEvents;
      updateVadState('LISTENING');
    } catch (err) {
      console.error("Voice capture setup error:", err);
      setSttError("Failed to start voice recording.");
      updateVadState('ERROR');
    }
  };

  const startConversation = () => {
    if (isEnding || outcome) return;
    // Reset user turn counter at the start of a new session
    setUserTurnCount(0);
    userTurnCountRef.current = 0;
    connectBackendWebSocket();
    setIsSessionActive(true);
    updateVadState('SETTING_UP');
    startVoiceCapture();
  };

  const handleSpeechEnd = (transcript) => {
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Increment user turn count
    const nextCount = userTurnCountRef.current + 1;
    userTurnCountRef.current = nextCount;
    setUserTurnCount(nextCount);

    // Simple detection of non‑ASCII characters to infer non‑English speech
    const nonEnglish = /[^\u0000-\u007F]/.test(trimmedTranscript);
    if (nonEnglish) {
      // Nudge the student to respond in English
      setSttError(T.pleaseSpeakEnglish);
    } else {
      setSttError(null);
    }

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

      // Compute overall score (mean of metrics) to send with the save request
      const metricScores = (report?.metrics || [])
        .filter(m => ['Grammar', 'Accuracy'].includes(m.name))
        .map(m => ({ name: m.name, percent: m.percent || 0 }));

      const saveRes = await fetch(`${API_BASE_URL}/session/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          cefrLevel: student.cefrLevel,
          timestamp: new Date().toISOString(),
          conversation: conversationRef.current,
          feedback: feedbackText,
          lessonId: activeLesson?.lessonId,
          metricScores
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
    userTurnCountRef.current = 0;
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
      summary: T.summary,
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
          suggestion: T.niceResponse
        })),
        quickTip: name === 'Grammar'
          ? T.tipGrammar
          : T.tipAccuracy
      }))
    };
  };

  const getOverallScore = (report) => {
    const metrics = (report?.metrics || []).filter(m => RESULT_METRICS.includes(m.name));
    if (!metrics.length) return null;
    return Math.round(metrics.reduce((sum, m) => sum + (m.percent || 0), 0) / metrics.length);
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
    const overallScore = getOverallScore(report);
    const totalQuestions = report.metrics[0]?.totalQuestions || 0;
    return (
      <div className="assessment-shell">
        <div className="assessment-content">
          {/* Overall score banner */}
          {overallScore !== null && (
            <div style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem', borderRadius: '16px', background: overallScore >= 60 ? '#ecfdf5' : '#fef2f2', border: `1px solid ${overallScore >= 60 ? '#10b981' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1.1rem', color: overallScore >= 60 ? '#065f46' : '#991b1b' }}>
                  {outcome?.passed ? T.passed : T.notYet}
                </div>
                <div style={{ fontSize: '0.85rem', color: overallScore >= 60 ? '#059669' : '#dc2626', marginTop: '2px' }}>
                  {overallScore >= 60 ? T.canAdvance : T.passRequirement}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: overallScore >= 60 ? '#10b981' : '#ef4444', lineHeight: 1 }}>{overallScore}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{T.overallScore}</div>
              </div>
            </div>
          )}

          <div className="assessment-heading">
            <p>{report.summary}</p>
          </div>

          <div className="result-summary-strip">
            <span>{T.totalAnswers}</span>
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
                  {T.viewDetails}
                </button>
              </div>
            ))}
          </div>

          <div className="result-actions">
            {outcome?.passed ? (
              <button className="primary-result-btn" type="button" onClick={handleNextLesson}>
                {T.nextLesson}{outcome.nextLesson?.title ? `: ${outcome.nextLesson.title}` : ''}
              </button>
            ) : (
              <button className="primary-result-btn" type="button" onClick={handleRetry}>
                {T.practiceAgain}
              </button>
            )}
            <button className="secondary-result-btn" type="button" onClick={() => setSelectedMetric(report.metrics[0]?.name)}>
              {T.viewDetails}
            </button>
            <button className="text-result-btn" type="button" onClick={onViewDashboard}>
              {T.returnHome}
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
          <span>{T.resultDetails}</span>
        </div>
        <div className="assessment-content detail">
          <h2 className="metric-title" style={{ color }}>{metric.name}</h2>
          <div className="score-ring" style={{ background: `conic-gradient(${color} ${metric.percent * 3.6}deg, #eef2f7 0deg)` }}>
            <div className="score-ring-inner">{metric.percent}%</div>
          </div>
          <p className="metric-note">
            {metric.percent >= 90
              ? T.strongWork
              : T.partialCredit}
          </p>

          <div className="review-panel">
            <h3>{T.conversationReview}</h3>
            <div className="review-list">
              {(metric.review || []).map((item, idx) => {
                const isCorrect = item.status === 'correct';
                const isPartial = item.status === 'partial';
                const issueText = item.issue || (!isCorrect ? (isPartial ? T.partlyCorrect : T.needsImprovement) : '');
                const rawSuggestion = item.suggestion || '';

                // Parse the 'Try: "actual English sentence"' format the LLM produces.
                // We re-render it as: "<T.tryPrefix>: <english sentence>" so only the
                // label word is translated, keeping the model answer in English.
                let suggestionLabel = T.tryPrefix;   // "Try" / "ሞክር"
                let suggestionBody  = rawSuggestion;  // full text fallback
                const tryMatch = rawSuggestion.match(/^[Tt]ry\s*:\s*(.+)$/s);
                if (tryMatch) {
                  suggestionBody = tryMatch[1].trim();
                }

                return (
                  <div className="review-item" key={`${metric.name}-${idx}`}>
                    <div className={`review-status ${isCorrect ? 'correct' : isPartial ? 'partial' : 'missing'}`}>
                      {isCorrect ? <CheckCircle2 size={14} /> : <HelpCircle size={14} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>{item.answer || `${T.answer} ${idx + 1}`}</p>
                      {isCorrect ? (
                        <span style={{ fontSize: '0.82rem', color: '#059669' }}>{T.strongAnswer}</span>
                      ) : (
                        <>
                          {issueText && (
                            <span style={{ display: 'block', fontSize: '0.82rem', color: isPartial ? '#b45309' : '#dc2626', marginBottom: rawSuggestion ? '6px' : '0' }}>
                              ⚠ {issueText}
                            </span>
                          )}
                          {rawSuggestion && (
                            <div style={{
                              marginTop: '6px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: '#f0fdf4',
                              border: '1px solid #86efac',
                              fontSize: '0.85rem',
                              color: '#166534',
                            }}>
                              💡 <span style={{ fontWeight: 600 }}>{suggestionLabel}:</span>{' '}
                              <span style={{ fontStyle: 'italic' }}>{suggestionBody}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="summary-panel">
            <h3>{T.summary}</h3>
            <div><span>{T.totalAnswers}</span><strong>{metric.totalQuestions}</strong></div>
            <div><span>{T.scoreEarned}</span><strong className="positive">{metric.correct}</strong></div>
            <div><span>{T.scoreMissed}</span><strong className="negative">{metric.missing}</strong></div>
          </div>

          <div className="quick-tip">
            <Lightbulb size={18} />
            <div>
              <strong>{T.quickTip}</strong>
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
              {T.nextMetric}
            </button>
            <button className="primary-result-btn" type="button" onClick={handleRetry}>
              {T.practiceAgain}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderIndicator = () => {
    if (!isSessionActive) return null;
    const limitReached = userTurnCountRef.current >= MAX_TURNS || isEndingRef.current;
    switch(vadState) {
      case 'SETTING_UP': return <div className="vad-indicator processing"><Loader2 size={24} className="spin-icon" color="#8b5cf6" /><span>{T.settingUp}</span></div>;
      case 'LISTENING':
        if (limitReached) return <div className="vad-indicator processing"><Loader2 size={24} className="spin-icon" color="#ec4899" /><span>{T.finishing}</span></div>;
        return <div className="vad-indicator listening"><Mic size={24} color="#8b5cf6" /><span>{T.yourTurn}</span></div>;
      case 'SPEAKING':
        if (limitReached) return <div className="vad-indicator processing"><Loader2 size={24} className="spin-icon" color="#ec4899" /><span>{T.finishing}</span></div>;
        return <div className="vad-indicator speaking"><div className="pulsing-dot"></div><span>{T.recording}</span></div>;
      case 'PROCESSING': return <div className="vad-indicator processing"><Loader2 size={24} className="spin-icon" color="#ec4899" /><span>{limitReached ? T.finishing : T.thinking}</span></div>;
      case 'AI_SPEAKING': return <div className="vad-indicator ai-speaking"><Sparkles size={24} color="#eab308" /><span>{limitReached ? T.finishing : T.aiSpeaking}</span></div>;
      default: return null;
    }
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {showTestPrompt && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.98)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h2>{T.unlocked}</h2>
            <p>{T.mandatoryAssessment}</p>
            <a href="https://example.com/cefR-test" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginBottom: '1rem', color: '#86198f', fontWeight: '600' }}>{T.takeTest}</a>
            <br />
            <button onClick={() => setShowTestPrompt(false)} style={{ padding: '0.6rem 1.2rem', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>{T.close}</button>
          </div>
        </div>
      )}
      {outcome && (
        <div className="assessment-overlay">
          {selectedMetric ? renderMetricDetail() : renderResultsOverview()}
          <div className="assessment-level-complete">
            {outcome.levelComplete && (
              <>
                <p style={{ color: '#64748b', marginBottom: '1rem' }}>{T.levelCompletePrompt}</p>
                <a href="https://example.com/cefR-test" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginBottom: '1rem', color: '#86198f', fontWeight: '600' }}>{T.takeTest}</a>
                <div style={{ marginBottom: '1rem' }}>
                  <label htmlFor="newCefr" style={{ marginRight: '0.5rem' }}>{T.selectLevel}</label>
                  <select id="newCefr" value={selectedCefr || ''} onChange={e => setSelectedCefr(e.target.value)} style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                    <option value="">--{T.choose}--</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B1">B1</option>
                    <option value="B2">B2</option>
                    <option value="C1">C1</option>
                    <option value="C2">C2</option>
                  </select>
                </div>
                <button className="primary-btn" onClick={handleUpdateLevel} disabled={!selectedCefr} style={{ width: '100%', padding: '1rem', borderRadius: '12px', background: '#86198f', color: 'white', fontWeight: '700', border: 'none', cursor: selectedCefr ? 'pointer' : 'not-allowed', marginBottom: '1rem' }}>
                  {T.updateLevel}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>{activeLesson?.title || T.practiceSession}</h2>
          <p style={{ color: 'var(--text-muted)' }}>{activeLesson?.objective || T.objective}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: userTurnCount >= MAX_TURNS ? '#ef4444' : 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {T.turnLimit}: {userTurnCount} / {MAX_TURNS}
          </div>
          <button onClick={onViewDashboard} style={{ background: '#f1f5f9', color: '#64748b', padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>{T.exitSession}</button>
        </div>
      </div>

      <div className="chat-container" style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '1rem 0', display: 'flex', flexDirection: 'column' }}>
        {!isSessionActive && conversation.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <Mic size={32} color="#8b5cf6" />
            </div>
            <h3 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '0.5rem' }}>{T.fastMode}</h3>
            <p style={{ maxWidth: '300px', lineHeight: '1.6', marginBottom: '2rem' }}>{T.techInfo}</p>
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
              {isServerReady ? T.startConversation : T.wakingUp}
            </button>
          </div>
        )}

        {conversation.map((msg, idx) => {
          if (!msg.text && msg.role === 'ai') {
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginLeft: '0.5rem' }}>{T.aiPartner}</div>
                <div style={{ padding: '12px 18px', borderRadius: '18px', backgroundColor: '#f1f5f9', borderBottomLeftRadius: '4px' }}>
                  <Loader2 size={16} className="spin-icon" color="#64748b" />
                </div>
              </div>
            );
          }
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.25rem', marginRight: msg.role === 'user' ? '0.5rem' : '0', marginLeft: msg.role === 'ai' ? '0.5rem' : '0' }}>{msg.role === 'user' ? T.you : T.aiPartner}</div>
              <div style={{ padding: '12px 18px', borderRadius: '18px', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '85%', backgroundColor: msg.role === 'user' ? 'var(--primary)' : '#f1f5f9', color: msg.role === 'user' ? 'white' : 'var(--text-main)', borderBottomRightRadius: msg.role === 'user' ? '4px' : '18px', borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '18px', boxShadow: msg.role === 'user' ? '0 4px 12px rgba(158, 40, 145, 0.2)' : 'none' }}>{msg.text}</div>
            </div>
          )
        })}
        <div ref={chatEndRef} />
      </div>

      {sttError && (
        <div style={{ margin: '1rem 0', padding: '1rem', borderRadius: '14px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
          <strong>{T.error}:</strong> {sttError}
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
            placeholder={vadState === 'PROCESSING' ? T.thinking : T.typeMessage}
            disabled={vadState === 'PROCESSING' || isEnding || userTurnCount >= MAX_TURNS}
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
            <button onClick={endSession} disabled={vadState === 'PROCESSING'} style={{ background: '#f1f5f9', color: '#64748b', padding: '10px 16px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>{T.endEarly}</button>
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
