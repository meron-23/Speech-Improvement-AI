import React, { useState, useRef } from 'react';
import API_BASE_URL from './config';

function Session({ student, onViewDashboard }) {
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [conversation, setConversation] = useState([]); // { role: 'user' | 'ai', text: string }
  const [status, setStatus] = useState(''); // E.g., 'Transcribing...', 'Thinking...', 'Generating Audio...'

  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);
  const pcmDataRef = useRef([]);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      pcmDataRef.current = [];
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmDataRef.current.push(new Float32Array(inputData));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      setIsRecording(true);
      setStatus('Recording...');
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access denied or error.");
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    setStatus('Processing...');
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // Convert PCM to WAV
    const wavBlob = encodeWAV(pcmDataRef.current, 16000);
    processAudio(wavBlob);
  };

  const encodeWAV = (samples, sampleRate) => {
    let flatSamples = new Float32Array(samples.reduce((acc, s) => acc + s.length, 0));
    let offset = 0;
    for (let s of samples) {
      flatSamples.set(s, offset);
      offset += s.length;
    }

    const buffer = new ArrayBuffer(44 + flatSamples.length * 2);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + flatSamples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, flatSamples.length * 2, true);

    let index = 44;
    for (let i = 0; i < flatSamples.length; i++) {
      let s = Math.max(-1, Math.min(1, flatSamples[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      index += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
  };

  const processAudio = async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    setProcessing(true);
    setStatus('Transcribing speech...');

    try {
      // 1. STT
      const sttRes = await fetch(`${API_BASE_URL}/stt`, { method: 'POST', body: formData });
      const sttData = await sttRes.json();
      if (!sttData.text || sttData.error) throw new Error(sttData.error || "Failed to transcribe");
      
      const userText = sttData.text;
      setConversation(prev => {
        const updated = [...prev, { role: 'user', text: userText }];
        setTimeout(scrollToBottom, 100);
        return updated;
      });

      // 2. Conversation LLM
      setStatus('Thinking...');
      const chatRes = await fetch(`${API_BASE_URL}/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: userText,
          history: conversation.slice(-5), // last 5 messages
          cefrLevel: student.cefrLevel
        })
      });
      const chatData = await chatRes.json();
      if (!chatData.text || chatData.error) throw new Error(chatData.error || "Failed to generate response");
      
      const aiText = chatData.text;
      setConversation(prev => {
        const updated = [...prev, { role: 'ai', text: aiText }];
        setTimeout(scrollToBottom, 100);
        return updated;
      });

      // 3. TTS
      setStatus('Generating audio...');
      const ttsRes = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText })
      });
      const ttsData = await ttsRes.json();
      if (!ttsData.audio || ttsData.error) throw new Error(ttsData.error || "Failed to generate TTS");

      // Play Audio
      setStatus('');
      const audioFormat = ttsData.format || 'wav';
      const audioUrl = `data:audio/${audioFormat};base64,${ttsData.audio}`;
      const audio = new Audio(audioUrl);
      audio.play();

    } catch (err) {
      alert("Error: " + err.message);
      setStatus('');
    } finally {
      setProcessing(false);
    }
  };

  const endSession = async () => {
    setProcessing(true);
    setStatus('Generating feedback and saving session...');

    try {
      // 1. Get Feedback
      const feedbackRes = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation })
      });
      const feedbackData = await feedbackRes.json();
      const feedbackText = feedbackData.feedback || "No feedback generated.";

      // 2. Save Session
      await fetch(`${API_BASE_URL}/session/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          cefrLevel: student.cefrLevel,
          timestamp: new Date().toISOString(),
          conversation: conversation,
          feedback: feedbackText
        })
      });

      alert("Session saved successfully!");
      onViewDashboard();
    } catch (err) {
      alert("Error saving session: " + err.message);
    } finally {
      setProcessing(false);
      setStatus('');
    }
  };

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 150px)', display: 'flex', flexDirection: 'column' }}>
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>AI Practice Partner</h2>
          <p style={{ color: 'var(--text-muted)' }}>Focus on natural conversation and fluency.</p>
        </div>
        <button className="nav-item" onClick={onViewDashboard} style={{ width: 'auto', background: 'transparent' }}>
          Cancel Session
        </button>
      </div>

      <div className="chat-container">
        {conversation.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto', opacity: 0.7 }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎙️</div>
            <h3>Your partner is ready.</h3>
            <p>Click the microphone button to start the conversation.</p>
          </div>
        )}
        {conversation.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {status && !isRecording && (
          <div style={{ textAlign: 'center', color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem', padding: '1rem', background: 'rgba(158, 40, 145, 0.05)', borderRadius: '12px', margin: '1rem auto', maxWidth: '200px' }}>
            <span className="recording-indicator" style={{ backgroundColor: 'var(--primary)' }}></span>
            {status}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', padding: '1rem 0' }}>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {conversation.length > 0 && (
              <button onClick={() => setConversation([])} disabled={processing} style={{ background: '#f1f5f9', color: 'var(--text-muted)', padding: '12px 24px' }}>
                Restart
              </button>
            )}
        </div>

        <div style={{ position: 'relative' }}>
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                disabled={processing}
                style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    padding: 0,
                    boxShadow: '0 10px 25px rgba(158, 40, 145, 0.3)'
                }}
              >
                <span style={{ fontSize: '2rem' }}>🎙️</span>
              </button>
            ) : (
              <button 
                onClick={stopRecording} 
                style={{ 
                    background: '#ef4444', 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '50%', 
                    padding: 0,
                    boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)'
                }}
              >
                <span style={{ fontSize: '2rem' }}>⏹️</span>
              </button>
            )}
            {isRecording && (
                <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: '700', color: '#ef4444' }}>
                   LIVE RECORDING
                </div>
            )}
        </div>

        <div style={{ flex: 1 }}>
            {conversation.length > 0 && (
              <button onClick={endSession} disabled={processing} style={{ background: 'linear-gradient(to right, #ec4899, #8b5cf6)', padding: '12px 24px' }}>
                Complete Session
              </button>
            )}
        </div>
      </div>
    </div>
  );
}

export default Session;
