import { useState, useRef, useCallback } from 'react';

// Gemini Live API - WebSocket endpoint (v1beta)
const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

interface GeminiLiveOptions {
    apiKey: string;
    onTranscriptChange: (text: string) => void;
    onStateChange?: (isRecording: boolean) => void;
}

async function decodeWsMessage(data: any): Promise<string> {
    if (typeof data === 'string') return data;
    if (data instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(data);
    if (data instanceof Blob) return await data.text();
    return String(data);
}

export function useGeminiLive({ apiKey, onTranscriptChange, onStateChange }: GeminiLiveOptions) {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const secondaryAudioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    const fullTranscriptRef = useRef<string>('');
    const setupCompleteRef = useRef<boolean>(false);

    const stopRecording = useCallback(() => {
        setupCompleteRef.current = false;
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(() => { });
            audioContextRef.current = null;
        }
        if (secondaryAudioContextRef.current) {
            secondaryAudioContextRef.current.close().catch(() => { });
            secondaryAudioContextRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.onerror = null;
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsRecording(false);
        onStateChange?.(false);
    }, [onStateChange]);

    const startRecording = useCallback(async (source: 'mic' | 'screen' = 'mic') => {
        if (!apiKey) {
            setError("API Key mancante!");
            return;
        }

        try {
            setError(null);
            fullTranscriptRef.current = '';
            setupCompleteRef.current = false;
            onTranscriptChange('');

            // ---- 1. Acquisizione Audio ----
            let stream: MediaStream;
            if (source === 'mic') {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                    video: false
                });
            } else {
                stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
                if (stream.getAudioTracks().length === 0) {
                    throw new Error("Nessuna traccia audio. Assicurati di spuntare 'Condividi audio'.");
                }
            }
            mediaStreamRef.current = stream;

            const audioTrack = stream.getAudioTracks()[0];
            console.log("[Audio] Traccia:", audioTrack.label);
            console.log("[Audio] Settings:", JSON.stringify(audioTrack.getSettings()));

            // ---- 2. WebSocket ----
            const websocket = new WebSocket(`${WS_URL}?key=${apiKey}`);
            wsRef.current = websocket;
            websocket.binaryType = 'arraybuffer';

            const setupPromise = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Timeout: server non ha risposto al setup entro 15s."));
                }, 15000);

                websocket.onopen = () => {
                    console.log("[Gemini WS] Connesso, invio setup...");
                    const setupMsg = {
                        setup: {
                            model: "models/gemini-2.5-flash-native-audio-preview-12-2025",
                            generationConfig: {
                                responseModalities: ["AUDIO"],
                            },
                            inputAudioTranscription: {},
                            outputAudioTranscription: {},
                            systemInstruction: {
                                parts: [{
                                    text: "You are a real-time speech-to-text transcriber. Listen carefully to the user's audio and repeat EXACTLY what they say, word for word, in the same language they speak. Do not answer questions. Do not add commentary. Do not use bold text or markdown formatting. Just transcribe."
                                }]
                            }
                        }
                    };
                    websocket.send(JSON.stringify(setupMsg));
                };

                websocket.onmessage = async (event) => {
                    try {
                        const textData = await decodeWsMessage(event.data);
                        let response: any;
                        try {
                            response = JSON.parse(textData);
                        } catch {
                            return;
                        }

                        if (response.setupComplete !== undefined) {
                            console.log("[Gemini WS] ✅ Setup completato!");
                            setupCompleteRef.current = true;
                            clearTimeout(timeout);
                            resolve();
                            return;
                        }

                        // Trascrizione INPUT
                        if (response.serverContent?.inputTranscription?.text) {
                            const t = response.serverContent.inputTranscription.text;
                            console.log("[Gemini] 📝 Input:", t);
                            fullTranscriptRef.current += t;
                            onTranscriptChange(fullTranscriptRef.current);
                        }

                        // Trascrizione OUTPUT — solo log, NON mostrare a schermo
                        // (è il modello che "pensa" o ripete, non l'utente)
                        if (response.serverContent?.outputTranscription?.text) {
                            console.log("[Gemini] 🤖 Output (ignorato):", response.serverContent.outputTranscription.text);
                        }

                        // Testo diretto del modello — solo log, NON mostrare
                        if (response.serverContent?.modelTurn?.parts) {
                            for (const part of response.serverContent.modelTurn.parts) {
                                if (part.text) {
                                    console.log("[Gemini] 💬 Model text (ignorato):", part.text);
                                }
                            }
                        }

                        if (response.serverContent?.turnComplete) {
                            console.log("[Gemini] 🔄 Turn completato");
                        }
                    } catch (e) {
                        console.error("[Gemini WS] Errore:", e);
                    }
                };

                websocket.onerror = (e) => {
                    console.error("[Gemini WS] Errore:", e);
                    clearTimeout(timeout);
                    reject(new Error("Errore connessione WebSocket."));
                };

                websocket.onclose = (e) => {
                    console.log("[Gemini WS] Chiuso:", e.code, e.reason);
                    clearTimeout(timeout);
                    if (!setupCompleteRef.current) {
                        reject(new Error(`WS chiuso: ${e.reason || 'sconosciuto'}`));
                    } else {
                        stopRecording();
                    }
                };
            });

            await setupPromise;
            console.log("[Gemini] Setup OK, avvio audio...");

            // ---- 3. Audio Processing ----
            // Strategia: per il MICROFONO, usiamo un approccio a doppio AudioContext.
            // 1) AudioContext nativo (48kHz) cattura il mic
            // 2) MediaStreamDestination → secondo AudioContext a 16kHz → ScriptProcessor
            //
            // Per lo SCREEN SHARE, il sample rate è solitamente 48kHz come il mic,
            // ma il display audio funzionava con 16kHz diretto, quindi usiamo lo stesso approccio.

            // Primo AudioContext: cattura a sample rate nativo per compatibilità massima
            const nativeCtx = new window.AudioContext();
            audioContextRef.current = nativeCtx;
            const nativeRate = nativeCtx.sampleRate;
            console.log(`[Audio] Sample rate nativo: ${nativeRate}`);

            const sourceNode = nativeCtx.createMediaStreamSource(stream);

            // Creiamo un MediaStreamDestination per "estrarre" lo stream dal contesto nativo
            const dest = nativeCtx.createMediaStreamDestination();
            sourceNode.connect(dest);

            // Secondo AudioContext a 16kHz per il processing finale
            const ctx16k = new window.AudioContext({ sampleRate: 16000 });
            secondaryAudioContextRef.current = ctx16k;

            const source16k = ctx16k.createMediaStreamSource(dest.stream);
            const processor = ctx16k.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source16k.connect(processor);
            processor.connect(ctx16k.destination);

            let chunkCount = 0;

            processor.onaudioprocess = (e) => {
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                if (!setupCompleteRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);

                // A questo punto i dati sono GIÀ a 16kHz grazie all'AudioContext secondario
                // Convertiamo direttamente a PCM Int16
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Int16 -> Base64
                const bytes = new Uint8Array(pcmData.buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = window.btoa(binary);

                wsRef.current.send(JSON.stringify({
                    realtimeInput: {
                        mediaChunks: [{
                            mimeType: "audio/pcm;rate=16000",
                            data: base64Data
                        }]
                    }
                }));

                chunkCount++;
                if (chunkCount === 1) {
                    // Log dettagliato del primo chunk
                    let maxAmp = 0;
                    for (let i = 0; i < inputData.length; i++) {
                        if (Math.abs(inputData[i]) > maxAmp) maxAmp = Math.abs(inputData[i]);
                    }
                    console.log(`[Audio] Primo chunk: ${inputData.length} samples @16kHz, max amp=${maxAmp.toFixed(4)}, base64 len=${base64Data.length}`);
                }
                if (chunkCount % 50 === 0) {
                    console.log(`[Audio] 🎙️ Chunk #${chunkCount} inviati`);
                }
            };

            setIsRecording(true);
            onStateChange?.(true);
            console.log("[Gemini] ✅ Registrazione avviata! Parla...");

        } catch (err: any) {
            console.error("[Gemini] ❌ Errore:", err);
            setError(err.message || "Errore sconosciuto.");
            stopRecording();
        }
    }, [apiKey, onStateChange, onTranscriptChange, stopRecording]);

    return {
        isRecording,
        startRecording,
        stopRecording,
        error
    };
}
