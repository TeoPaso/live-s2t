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
                                    `You are a real-time high-impact summary tool. Extract exactly ONE new "pick" (insight) from the transcript.
Rules:
- 3 to 5 words MAX.
- AVOID REPEATING recent points. Look for the NEWEST info.
- If it contains a NUMBER, wrap it in # (e.g., #42# megabyte).
- Use **double asterisks** for the core concept.
- "type" MUST be one of: "key_point", "data", "concept".
- Format: {"text": "Aumento del **#20%#**", "type": "data"}

Recent insights history (DO NOT REPEAT):
${insights.slice(-3).map(i => i.text).join(' | ')}

Transcript:
"""
${currentText.slice(-1000)}
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
                        const newText = String(item.text).trim();
                        setInsights(prev => {
                            // Deduplicate: don't add if it's identical to the last one
                            if (prev.length > 0 && prev[prev.length - 1].text === newText) {
                                return prev;
                            }

                            const newPick = {
                                id: ++idRef.current,
                                text: newText,
                                type: (['key_point', 'data', 'concept'].includes(item.type) ? item.type : 'key_point') as any,
                                emoji: TYPE_EMOJI[item.type] || TYPE_EMOJI.key_point,
                            };
                            // Show only last 3 picks for maximum impact
                            return [...prev.slice(-2), newPick];
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
