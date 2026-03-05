import { useState, useEffect, useRef } from 'react'
import { Mic, ScreenShare, Eye, ZoomIn, ZoomOut, Save, ArrowUpFromLine, Download, FileText, Type } from 'lucide-react'
import { useGeminiLive } from './useGeminiLive'
import { useKeyInsights } from './useKeyInsights'
import { exportToTxt, exportToDocx, exportToPdf } from './exportUtils'
import './index.css'

type ViewMode = 'top-text' | 'teleprompter'

/** Parse **bold** markers into JSX and #numbers# into large spans */
function renderInsightText(text: string) {
  // First split by bold
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g)
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`b-${i}`}>{renderInsightTextInternal(part.slice(2, -2))}</strong>
    }
    return <span key={`s-${i}`}>{renderInsightTextInternal(part)}</span>
  })
}

function renderInsightTextInternal(text: string) {
  const numParts = text.split(/(#[^#]+#)/g)
  return numParts.map((part, j) => {
    if (part.startsWith('#') && part.endsWith('#')) {
      return <span key={`n-${j}`} className="insight-number">{part.slice(1, -1)}</span>
    }
    return part
  })
}

function App() {
  const [apiKey, setApiKey] = useState<string>('')
  const [hasApiKey, setHasApiKey] = useState<boolean>(true)
  const [viewMode, setViewMode] = useState<ViewMode>('top-text')
  const [fontSize, setFontSize] = useState<number>(36)
  const [showExportMenu, setShowExportMenu] = useState(false)

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

      {/* Header — Logo and Secondary Controls */}
      <header className="controls-header">
        <div className="flex-row">
          <div className="logo-container">
            <span className="logo-text">Live S2T</span>
            <Mic size={14} className="logo-sub-icon" />
          </div>
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

          <div className="export-container">
            <button
              className={`btn-icon ${showExportMenu ? 'active' : ''}`}
              title="Esporta Trascrizione"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!transcript}
            >
              <Download size={20} />
            </button>

            {showExportMenu && (
              <div className="export-dropdown">
                <button onClick={() => { exportToTxt(transcript); setShowExportMenu(false); }}>
                  <Type size={16} /> Testo (.txt)
                </button>
                <button onClick={() => { exportToDocx(transcript); setShowExportMenu(false); }}>
                  <FileText size={16} /> Word (.docx)
                </button>
                <button onClick={() => { exportToPdf(transcript); setShowExportMenu(false); }}>
                  <Save size={16} /> PDF (.pdf)
                </button>
              </div>
            )}
          </div>
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
              <span key={`word-${i}-${word}`} className="word-box">
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

      {/* Key Insights Panel — shows 1 pick at a time, replaces on update */}
      {viewMode === 'top-text' && insights.length > 0 && (() => {
        const insight = insights[0]
        return (
          <section className="insights-panel">
            <div
              key={insight.id}
              className={`insight-card insight-${insight.type}`}
            >
              <span className="insight-emoji">{insight.emoji}</span>
              <span className="insight-text">{renderInsightText(insight.text)}</span>
            </div>
          </section>
        )
      })()}

      {/* Bottom Actions — Recording controls moved here */}
      <footer className="bottom-actions">
        <div className="flex-row">
          <button
            className={`btn btn-main-action ${isRecording ? 'is-recording' : ''}`}
            onClick={toggleRecording}
          >
            {isRecording ? <span className="recording-dot"></span> : <Mic size={20} />}
            {isRecording ? 'Stop Mic' : 'Trascrivi Mic'}
          </button>

          <button
            className={`btn btn-main-action ${isRecording ? 'active' : ''}`}
            onClick={toggleScreenAudio}
          >
            <ScreenShare size={20} /> Audio di Sistema
          </button>
        </div>
      </footer>

    </div>
  )
}

export default App
