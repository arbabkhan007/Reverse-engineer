import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hands-free pattern reading using the browser's speech synthesis.
 *
 * Reads one instruction at a time so the maker can keep both hands on the
 * hook and advance with a large tap target. No network, no audio files.
 */

export interface SpeechState {
  supported: boolean;
  speaking: boolean;
  /** Index of the step currently being read, or null. */
  current: number | null;
  rate: number;
  setRate: (rate: number) => void;
  speak: (text: string, index?: number) => void;
  stop: () => void;
  toggle: () => void;
}

function expandForSpeech(text: string): string {
  // Stitch abbreviations are unreadable when spoken letter by letter.
  return text
    .replace(/\bmr\b/gi, 'magic ring')
    .replace(/\bsc\b/gi, 'single crochet')
    .replace(/\bhdc\b/gi, 'half double crochet')
    .replace(/\bdc\b/gi, 'double crochet')
    .replace(/\btr\b/gi, 'treble crochet')
    .replace(/\bslst\b/gi, 'slip stitch')
    .replace(/\binc\b/gi, 'increase')
    .replace(/\bdec\b/gi, 'decrease')
    .replace(/\bch\b/gi, 'chain')
    .replace(/\bsts?\b/gi, 'stitches')
    .replace(/\((\d+)\)/g, ', $1 stitches');
}

export function useSpeech(): SpeechState {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [current, setCurrent] = useState<number | null>(null);
  const [rate, setRateState] = useState(0.9);
  const lastText = useRef<string>('');
  const lastIndex = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!supported) return;
    return () => window.speechSynthesis.cancel();
  }, [supported]);

  const speak = useCallback(
    (text: string, index?: number) => {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(expandForSpeech(text));
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.onstart = () => {
        setSpeaking(true);
        setCurrent(index ?? null);
      };
      utterance.onend = () => {
        setSpeaking(false);
        setCurrent(null);
      };
      utterance.onerror = () => {
        setSpeaking(false);
        setCurrent(null);
      };
      lastText.current = text;
      lastIndex.current = index;
      window.speechSynthesis.speak(utterance);
    },
    [supported, rate],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setCurrent(null);
  }, [supported]);

  const toggle = useCallback(() => {
    if (speaking) stop();
    else if (lastText.current) speak(lastText.current, lastIndex.current);
  }, [speaking, speak, stop]);

  const setRate = useCallback(
    (next: number) => {
      const clamped = Math.max(0.5, Math.min(1.6, next));
      setRateState(clamped);
      // Rate only applies to the next utterance; restart if mid-sentence.
      if (speaking && lastText.current) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(expandForSpeech(lastText.current));
        utterance.rate = clamped;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => {
          setSpeaking(false);
          setCurrent(null);
        };
        window.speechSynthesis.speak(utterance);
      }
    },
    [speaking],
  );

  return { supported, speaking, current, rate, setRate, speak, stop, toggle };
}
