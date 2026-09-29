// Konuşma tanıma ve sesli okuma. APK'da (Capacitor) yerel Android eklentileri,
// tarayıcıda Web Speech API kullanılır. Android WebView Web Speech tanımayı desteklemez.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

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

export const stopSpeaking = () => {
  if (isNative) {
    TextToSpeech.stop().catch(() => {});
  } else if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

export const speak = async (text: string, langCode: string) => {
  stopSpeaking();
  if (isNative) {
    try {
      await TextToSpeech.speak({ text, lang: langCode, rate: 1.0, volume: 1.0 });
    } catch (e) {
      console.error('TTS error:', e);
      // Seçilen lehçe için ses yoksa ana dile düş (ör. ar-EG -> ar)
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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
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

export const startListening = async (langCode: string): Promise<ListenSession | null> => {
  stopSpeaking();
  return isNative ? startNative(langCode) : startWeb(langCode);
};
