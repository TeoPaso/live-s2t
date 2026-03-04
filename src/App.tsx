import { useState, useEffect, useRef } from 'react'
import { Mic, ScreenShare, Eye, ZoomIn, ZoomOut, Save, ArrowUpFromLine } from 'lucide-react'
import { useGeminiLive } from './useGeminiLive'
import { useKeyInsights } from './useKeyInsights'
import './index.css'

type ViewMode = 'top-text' | 'teleprompter'

/** Parse **bold** markers into JSX */
function renderBoldText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [hasApiKey, setHasApiKey] = useState<boolean>(true)
  const [viewMode, setViewMode] = useState<ViewMode>('top-text')
  const [fontSize, setFontSize] = useState<number>(36)

  const [transcript, setTranscript] = useState<string>('')
  const transcriptAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedKey = localStorage.getItem('GEMINI_API_KEY')
    const envKey = import.meta.env.VITE_GEMINI_API_KEY
    if (storedKey) {
      setApiKey(storedKey)
      setHasApiKey(true)
    } else if (envKey) {
      setApiKey(envKey)
      setHasApiKey(true)
    } else {
      setHasApiKey(false)
    }
  }, [])

  const saveApiKey = (e: React.FormEvent) => {
    e.preventDefault()
    if (apiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', apiKey.trim())
      setHasApiKey(true)
    }
  }

  const { isRecording, startRecording, stopRecording, error } = useGeminiLive({
    apiKey,
    onTranscriptChange: setTranscript
  })

  const insights = useKeyInsights(transcript, apiKey)

  const toggleRecording = () => {
    if (isRecording) stopRecording()
    else startRecording('mic')
  }

  const toggleScreenAudio = () => {
    if (isRecording) stopRecording()
    else startRecording('screen')
  }

  const changeFontSize = (delta: number) => {
    setFontSize(prev => Math.min(Math.max(16, prev + delta), 120))
  }

  // Auto-scroll in top-text mode
  useEffect(() => {
    if (viewMode === 'top-text' && transcriptAreaRef.current) {
      transcriptAreaRef.current.scrollTop = transcriptAreaRef.current.scrollHeight
    }
  }, [transcript, viewMode])

  if (!hasApiKey) {
    return (
      <div className="modal-overlay">
        <form onSubmit={saveApiKey} className="modal">
          <h2>Benvenuto in Live S2T</h2>
          <p>Per iniziare, inserisci la tua API Key di Google Gemini. Verrà salvata in modo sicuro solo sul tuo dispositivo locale.</p>
          <input
            type="password"
            className="input"
            placeholder="AIzaSy..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Salva e Inizia</button>
        </form>
      </div>
    )
  }

  return (
    <div className={`app-container mode-${viewMode}`}>

      {/* Header Controls */}
      <header className="controls-header">
        <div className="flex-row">
          <span className="logo-text">Live S2T</span>
          <div style={{ width: '2px', height: '24px', background: 'var(--border)', margin: '0 10px' }}></div>

          <button
            className={`btn ${isRecording ? 'btn-primary' : ''}`}
            onClick={toggleRecording}
            style={isRecording ? { background: 'var(--danger)' } : {}}
          >
            {isRecording ? <span className="recording-dot"></span> : <Mic size={18} />}
            {isRecording ? 'Stop Mic' : 'Trascrivi Mic'}
          </button>

          <button className={`btn ${isRecording ? 'btn-primary' : ''}`} onClick={toggleScreenAudio}>
            <ScreenShare size={18} /> Audio di Sistema
          </button>
        </div>

        <div className="flex-row">
          {error && <span style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{error}</span>}
          <button className="btn-icon" title="Rimpicciolisci Testo" onClick={() => changeFontSize(-4)}>
            <ZoomOut size={20} />
          </button>
          <button className="btn-icon" title="Ingrandisci Testo" onClick={() => changeFontSize(4)}>
            <ZoomIn size={20} />
          </button>

          <div style={{ width: '2px', height: '24px', background: 'var(--border)', margin: '0 5px' }}></div>

          <button
            className="btn-icon"
            title={viewMode === 'top-text' ? 'Passa a Teleprompter' : 'Passa a Top-Text'}
            onClick={() => setViewMode(viewMode === 'top-text' ? 'teleprompter' : 'top-text')}
          >
            {viewMode === 'top-text' ? <Eye size={20} /> : <ArrowUpFromLine size={20} />}
          </button>

          <button className="btn-icon" title="Archivio Registrazioni">
            <Save size={20} />
          </button>
        </div>
      </header>

      {/* Transcription Area */}
      <main className="transcriber-area" ref={transcriptAreaRef}>
        <div
          className="transcriber-content"
          style={{ fontSize: `${fontSize}px` }}
        >
          {transcript ? (
            transcript.split(' ').filter(w => w.length > 0).map((word, i) => (
              <span key={`word-${i}-${word}`} className="word-box" style={{ animationDelay: `${(i % 10) * 0.05}s` }}>
                {word}
              </span>
            ))
          ) : isRecording ? (
            <span style={{ opacity: 0.5 }}>In ascolto...</span>
          ) : (
            <span style={{ opacity: 0.3 }}>Premi Trascrivi o seleziona Audio di Sistema per iniziare...</span>
          )}
        </div>
      </main>

      {/* Key Insights Panel — bottom portion, only in top-text mode */}
      {viewMode === 'top-text' && insights.length > 0 && (
        <section className="insights-panel">
          <div className="insights-label">
            <span className="insights-label-bar" />
            Punti chiave
          </div>
          <div className="insights-list">
            {insights.map((insight, i) => (
              <div
                key={insight.id}
                className={`insight-card insight-${insight.type}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="insight-emoji">{insight.emoji}</span>
                <span className="insight-text">{renderBoldText(insight.text)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

export default App
