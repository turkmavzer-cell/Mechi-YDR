// Konuşma tanıma ve sesli okuma. APK'da (Capacitor) yerel Android eklentileri,
// tarayıcıda Web Speech API kullanılır. Android WebView Web Speech tanımayı desteklemez.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Language } from '../types';
import { fetchDialectSpeech } from '../services/geminiService';

const isNative = Capacitor.isNativePlatform();

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export type ListenSession = {
  // Söylenen metni döndürür; hiçbir şey anlaşılmazsa boş string.
  result: Promise<string>;
  stop: () => void;
};

// Telefonun TTS sesinin doğru okuyamadığı lehçeler: bunlar Gemini'nin aksanlı sesiyle okunur
const DIALECT_VOICE_IDS = new Set([
  'ar-EG', 'ar-MA', 'ar-IQ', 'ar-LB', 'ar-SA',
  'de-DE-BAV', 'de-AT', 'de-CH',
  'az-AZ-BAK', 'az-IR-TAB', 'fa-AF', 'id-JAV',
  'en-UK-SCO', 'en-US-TX', 'es-ARG', 'it-NAP', 'jp-KYOT', 'ko-BUS',
  'ku-KUR', 'ku-SOR', 'ku-ZAZ', 'ru-BY', 'ru-UKR',
]);

export const usesDialectVoice = (lang: Language) => DIALECT_VOICE_IDS.has(lang.id);

// Aynı cümle tekrar okunursa sunucuya gitmeden çalınır
const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
// Her speak çağrısı bir öncekini geçersiz kılar (geç gelen ses çalınmasın)
let speakToken = 0;

export const stopSpeaking = () => {
  speakToken++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (isNative) {
    TextToSpeech.stop().catch(() => {});
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

const playWav = (base64: string, token: number) =>
  new Promise<void>((resolve) => {
    if (token !== speakToken) return resolve();
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    currentAudio = audio;
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    audio.onpause = () => resolve();
    audio.play().catch(() => resolve());
  });

const speakDevice = async (text: string, langCode: string) => {
  if (isNative) {
    try {
      await TextToSpeech.speak({ text, lang: langCode, rate: 1.0, volume: 1.0 });
    } catch (e) {
      console.error('TTS error:', e);
      // Seçilen bölge için ses yoksa ana dile düş (ör. ar-EG -> ar)
      const base = langCode.split('-')[0];
      if (base !== langCode) {
        await TextToSpeech.speak({ text, lang: base, rate: 1.0, volume: 1.0 }).catch(() => {});
      }
    }
    return;
  }
  if (!('speechSynthesis' in window)) {
    alert('Üzgünüz, tarayıcınız sesli okumayı desteklemiyor.');
    return;
  }
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.volume = 1;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
};

// Metni okur; okuma bitince (veya durdurulunca) tamamlanır
export const speak = async (text: string, lang: Language) => {
  stopSpeaking();
  const token = speakToken;
  if (usesDialectVoice(lang)) {
    const key = `${lang.id}|${text}`;
    let audio = audioCache.get(key) || null;
    if (!audio) {
      audio = await fetchDialectSpeech(text, lang);
      if (audio) {
        if (audioCache.size > 30) audioCache.delete(audioCache.keys().next().value!);
        audioCache.set(key, audio);
      }
    }
    if (token !== speakToken) return;
    if (audio) {
      await playWav(audio, token);
      return;
    }
    // Gemini sesi alınamazsa telefonun sesiyle oku
  }
  if (token !== speakToken) return;
  await speakDevice(text, lang.speechCode);
};

const startNative = async (langCode: string): Promise<ListenSession | null> => {
  const { available } = await SpeechRecognition.available();
  if (!available) {
    alert('Bu cihazda ses tanıma kullanılamıyor. Google uygulamasının yüklü ve güncel olduğundan emin olun.');
    return null;
  }
  const perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') {
    const req = await SpeechRecognition.requestPermissions();
    if (req.speechRecognition !== 'granted') {
      alert('Konuşarak çeviri için mikrofon izni gerekiyor.');
      return null;
    }
  }

  const result = SpeechRecognition.start({
    language: langCode,
    maxResults: 1,
    partialResults: false,
    popup: false,
  })
    .then((res) => res?.matches?.[0] || '')
    .catch((e) => {
      // "No match" vb. durumlar: kullanıcı bir şey söylemedi
      console.warn('Speech recognition:', e);
      return '';
    });

  return {
    result,
    stop: () => {
      SpeechRecognition.stop().catch(() => {});
    },
  };
};

const startWeb = (langCode: string): ListenSession | null => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    alert('Üzgünüz, tarayıcınız ses tanımayı desteklemiyor. Lütfen Chrome veya Edge kullanmayı deneyin.');
    return null;
  }
  const recognition = new Recognition();
  recognition.lang = langCode;
  recognition.interimResults = true;
  recognition.continuous = false;

  let transcript = '';
  const result = new Promise<string>((resolve) => {
    recognition.onresult = (event: any) => {
      transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
    };
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
    };
    recognition.onend = () => resolve(transcript);
  });
  recognition.start();

  return { result, stop: () => recognition.stop() };
};

// Sohbet modu WebView içinden mikrofon açar; Android izni önceden alınır
export const ensureMicPermission = async (): Promise<boolean> => {
  if (!isNative) return true;
  const perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition === 'granted') return true;
  const req = await SpeechRecognition.requestPermissions();
  return req.speechRecognition === 'granted';
};

export const startListening = async (langCode: string): Promise<ListenSession | null> => {
  stopSpeaking();
  return isNative ? startNative(langCode) : startWeb(langCode);
};
