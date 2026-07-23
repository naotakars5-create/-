"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API の最小型定義（TypeScript 標準に含まれないため）
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("このブラウザは音声入力（Web Speech API）に対応していません。Chrome をお使いください。");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(finalText + interim);
    };
    rec.onerror = (e) => {
      setError(`音声認識エラー: ${e.error}`);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    rec.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { supported, recording, transcript, error, start, stop, reset, setTranscript };
}
