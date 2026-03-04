import { useState, useRef, useEffect, useCallback } from 'react';

export interface KeyInsight {
    id: number;
    text: string;
    type: 'key_point' | 'data' | 'concept';
    emoji: string;
}

const TYPE_EMOJI: Record<string, string> = {
    key_point: '💡',
    data: '📊',
    concept: '🧠',
};

export function useKeyInsights(transcript: string, apiKey: string): KeyInsight[] {
    const [insights, setInsights] = useState<KeyInsight[]>([]);
    const lastAnalyzedLenRef = useRef(0);
    const analyzingRef = useRef(false);
    const idRef = useRef(0);
    const transcriptRef = useRef(transcript);

    transcriptRef.current = transcript;

    const analyze = useCallback(async () => {
        const currentText = transcriptRef.current;
        if (!apiKey || !currentText || currentText.length < 50) return;
        if (currentText.length - lastAnalyzedLenRef.current < 80) return;
        if (analyzingRef.current) return;

        analyzingRef.current = true;
        console.log('[KeyInsights] Analyzing...');

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text:
                                    `You are a real-time insight extractor. Analyze this live speech transcript and extract 3 to 5 key messages, data points, or main concepts.
Rules:
- Each insight must be a short sentence (max 15 words)
- Use **double asterisks** around the 1-2 most important words in each insight
- Respond ONLY with a JSON array (no markdown fences, no explanation)
- Format: [{"text": "I **maggiorenni** hanno diritto di **voto**", "type": "key_point"|"data"|"concept"}]
- "key_point": main argument or claim
- "data": number, statistic, factual reference
- "concept": abstract idea or topic discussed
- Write in the SAME LANGUAGE as the transcript

Transcript:
"""
${currentText}
"""` }]
                        }],
                        generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
                    })
                }
            );

            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (rawText) {
                const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setInsights(parsed.slice(0, 5).map((item: any) => ({
                            id: ++idRef.current,
                            text: String(item.text || '').trim(),
                            type: ['key_point', 'data', 'concept'].includes(item.type) ? item.type : 'key_point',
                            emoji: TYPE_EMOJI[item.type] || TYPE_EMOJI.key_point,
                        })));
                    }
                }
            }
            lastAnalyzedLenRef.current = currentText.length;
        } catch (err) {
            console.error('[KeyInsights] Error:', err);
        } finally {
            analyzingRef.current = false;
        }
    }, [apiKey]);

    // Periodic analysis every 15 seconds
    useEffect(() => {
        if (!apiKey) return;
        const interval = setInterval(analyze, 15000);
        return () => clearInterval(interval);
    }, [apiKey, analyze]);

    // Also trigger after 5s pause in speech with enough new text
    useEffect(() => {
        if (!transcript || transcript.length < 50) return;
        if (transcript.length - lastAnalyzedLenRef.current < 80) return;
        const timer = setTimeout(analyze, 5000);
        return () => clearTimeout(timer);
    }, [transcript, analyze]);

    // Reset when transcript is cleared
    useEffect(() => {
        if (!transcript) {
            setInsights([]);
            lastAnalyzedLenRef.current = 0;
        }
    }, [transcript]);

    return insights;
}
