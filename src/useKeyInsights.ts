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
        if (!apiKey || !currentText || currentText.length < 30) return;
        if (currentText.length - lastAnalyzedLenRef.current < 40) return;
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
                                    `You are a real-time insight extractor. Analyze this live speech transcript and extract exactly ONE high-impact "pick" representing the latest relevant point.
Rules:
- THE PICK MUST BE 1 TO 4 WORDS MAX.
- Content: extremely "straightforward", re-elaborated for maximum impact.
- Use **double asterisks** around the most important word(s).
- Respond ONLY with a single JSON object.
- Format: {"text": "**Voto** maggiorenni", "type": "key_point"|"data"|"concept"}
- "key_point": main argument/claim
- "data": number/statistic/fact
- "concept": abstract idea/topic
- SAME LANGUAGE as transcript.

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
                const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    const item = JSON.parse(jsonMatch[0]);
                    if (item && item.text) {
                        setInsights(prev => {
                            const newPick = {
                                id: ++idRef.current,
                                text: String(item.text).trim(),
                                type: ['key_point', 'data', 'concept'].includes(item.type) ? item.type : 'key_point',
                                emoji: TYPE_EMOJI[item.type] || TYPE_EMOJI.key_point,
                            };
                            // Keep only the last 4 picks to keep the screen clean
                            return [...prev.slice(-3), newPick];
                        });
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

    // Periodic analysis every 5 seconds
    useEffect(() => {
        if (!apiKey) return;
        const interval = setInterval(analyze, 5000);
        return () => clearInterval(interval);
    }, [apiKey, analyze]);

    // Also trigger after 3s pause in speech with enough new text
    useEffect(() => {
        if (!transcript || transcript.length < 30) return;
        if (transcript.length - lastAnalyzedLenRef.current < 40) return;
        const timer = setTimeout(analyze, 3000);
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
