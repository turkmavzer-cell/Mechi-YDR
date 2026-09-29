import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Language, LANGUAGES, Message } from './types';
import SettingsModal from './components/SettingsModal';
import { translateText, getLanguageFromLocation } from './services/geminiService';
import { LocalizationProvider, useLocalization } from './lib/i18n';
import { speak, stopSpeaking, startListening as startSpeechSession, ListenSession } from './lib/speech';

const AppContent: React.FC<{
    sourceLang: Language;
    setSourceLang: (l: Language) => void;
    targetLang: Language;
    setTargetLang: (l: Language) => void;
}> = ({sourceLang, setSourceLang, targetLang, setTargetLang}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<'text' | 'voice' | null>(null);
  const [textDirection, setTextDirection] = useState<'source' | 'target'>('source');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [listeningFor, setListeningFor] = useState<'source' | 'target' | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  
  const listenSessionRef = useRef<ListenSession | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { t } = useLocalization();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('Could not copy text: ', err);
    });
  };

  const swapLanguages = () => {
    setIsSwapping(true);
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    setTimeout(() => setIsSwapping(false), 500);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const speakText = (text: string, langCode: string) => {
    speak(text, langCode);
  };

  const handleConversationTurn = async (
    textToTranslate: string,
    originalLang: Language,
    translationTargetLang: Language
  ) => {
      if (!textToTranslate.trim()) return;
  
      const userMsg: Message = {
        id: Date.now().toString(),
        text: textToTranslate,
        sender: 'user',
        language: originalLang.name,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      setIsProcessing(true);
  
      const translatedText = await translateText(textToTranslate, originalLang.name, translationTargetLang.name);
  
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: translatedText,
        sender: 'bot',
        language: translationTargetLang.name,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
      setIsProcessing(false);
  
      speakText(translatedText, translationTargetLang.speechCode);
  };

  const handleTextSend = () => {
    if (!inputText.trim()) return;
    if (textDirection === 'source') {
      handleConversationTurn(inputText, sourceLang, targetLang);
    } else {
      handleConversationTurn(inputText, targetLang, sourceLang);
    }
    setInputText('');
    setInputMode(null);
  };

  const startListening = async (languageToListen: 'source' | 'target') => {
    stopSpeaking();
    // İkinci dokunuş dinlemeyi bitirir
    if (listenSessionRef.current) {
      listenSessionRef.current.stop();
      return;
    }

    const originalLang = languageToListen === 'source' ? sourceLang : targetLang;
    const targetLangForTranslation = languageToListen === 'source' ? targetLang : sourceLang;

    const session = await startSpeechSession(originalLang.speechCode);
    if (!session) return;

    listenSessionRef.current = session;
    setInputMode('voice');
    setListeningFor(languageToListen);

    const transcript = await session.result;
    listenSessionRef.current = null;
    setListeningFor(null);

    if (transcript.trim()) {
      handleConversationTurn(transcript, originalLang, targetLangForTranslation);
    }
  };

  useEffect(() => {
    return () => {
      listenSessionRef.current?.stop();
      stopSpeaking();
    }
  }, []);

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-dark shadow-2xl relative safe-top">
      <header className="flex justify-between items-center p-4 bg-surface/50 backdrop-blur-md sticky top-0 z-10 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white shrink-0">
            M
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold tracking-tight">MeChi</h1>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Yurt Dışı Rehber</span>
          </div>
        </div>
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 rounded-full hover:bg-white/10 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <div className="flex items-center justify-between px-6 py-2 bg-surface/30 text-xs font-medium text-gray-400 border-b border-gray-800">
        <motion.span 
          key={`source-${sourceLang.id}`}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1"
        >
          <span className="text-lg">{sourceLang.flag}</span> {sourceLang.name}
        </motion.span>
        
        <motion.button 
            onClick={swapLanguages}
            whileTap={{ scale: 0.8, rotate: 180 }}
            animate={{ rotate: isSwapping ? 180 : 0 }}
            className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
            title="Dilleri Değiştir"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
        </motion.button>

        <motion.span 
          key={`target-${targetLang.id}`}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1 text-primary"
        >
          {targetLang.name} <span className="text-lg">{targetLang.flag}</span>
        </motion.span>
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-50 mt-10">
                <div className="text-6xl mb-4">💬</div>
                <p>{t('startTyping')}</p>
            </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                msg.sender === 'user' 
                ? 'bg-primary text-white rounded-br-none' 
                : 'bg-surface text-gray-100 rounded-bl-none border border-gray-700'
            }`}>
                <p className="text-lg leading-snug">{msg.text}</p>
                <div className="mt-2 flex justify-between items-center text-xs opacity-70">
                    <span>{msg.language}</span>
                    <div className="flex items-center gap-1">
                        <button 
                          onClick={() => copyToClipboard(msg.text)}
                          className="p-1 hover:bg-white/20 rounded-full transition-colors"
                          title={t('copyMessage')}
                          aria-label={t('copyMessage')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                        </button>
                        {msg.sender === 'bot' && (
                            <button 
                              onClick={() => speakText(msg.text, targetLang.speechCode)}
                              className="p-1 hover:bg-white/20 rounded-full transition-colors"
                              aria-label={t('speakMessage')}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
          </div>
        ))}
        {isProcessing && (
            <div className="flex justify-start">
                <div className="bg-surface rounded-2xl rounded-bl-none p-4 border border-gray-700 flex gap-2 items-center">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200"></div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-10 safe-bottom px-6">
        {inputMode === 'text' ? (
            <div className="flex flex-col gap-2 bg-surface p-3 rounded-2xl border border-gray-600 shadow-2xl animate-slide-up">
                {/* Language direction selector header */}
                <div className="flex items-center justify-between border-b border-gray-700/60 pb-2 px-1">
                    <div className="flex items-center gap-1 bg-dark/60 p-1 rounded-xl text-xs">
                        <button
                            type="button"
                            onClick={() => setTextDirection('source')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                textDirection === 'source'
                                    ? 'bg-primary text-white font-semibold shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <span>{sourceLang.flag}</span>
                            <span>{sourceLang.name}</span>
                        </button>

                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>

                        <button
                            type="button"
                            onClick={() => setTextDirection('target')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                                textDirection === 'target'
                                    ? 'bg-secondary text-white font-semibold shadow-md'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <span>{targetLang.flag}</span>
                            <span>{targetLang.name}</span>
                        </button>
                    </div>

                    <button 
                        type="button"
                        onClick={() => setInputMode(null)} 
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition"
                        aria-label={t('cancel')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Textarea and Send button */}
                <div className="flex items-end gap-2">
                    <textarea 
                        autoFocus
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onFocus={() => stopSpeaking()}
                        placeholder={
                            textDirection === 'source'
                                ? `${sourceLang.flag} ${sourceLang.name} ${t('typeHere')}`
                                : `${targetLang.flag} ${targetLang.name} ${t('typeHere')}`
                        }
                        className="flex-1 bg-transparent text-white p-2 max-h-32 min-h-[50px] outline-none resize-none text-sm placeholder:text-gray-500"
                        onKeyDown={(e) => {
                            if(e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleTextSend();
                            }
                        }}
                    />
                    <button 
                        type="button"
                        onClick={handleTextSend}
                        disabled={!inputText.trim()}
                        className={`p-3 rounded-xl text-white disabled:opacity-50 transition-colors shrink-0 ${
                            textDirection === 'source' ? 'bg-primary' : 'bg-secondary'
                        }`}
                        title="Çevir ve Gönder"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
            </div>
        ) : (
            <div className="flex justify-around items-center">
                <div className="flex flex-col items-center gap-2 w-28 text-center">
                    <button
                        onClick={() => startListening('source')}
                        className={`h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                            listeningFor === 'source' ? 'bg-red-500 animate-pulse' : 'bg-primary'
                        } shadow-primary/30`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </button>
                    <span className="text-xs font-medium text-gray-300 truncate">{sourceLang.flag} {sourceLang.name}</span>
                </div>

                <button
                    onClick={() => setInputMode('text')}
                    className="h-14 w-14 bg-surface/80 backdrop-blur rounded-full border border-gray-600 flex items-center justify-center active:scale-95 transition"
                    aria-label={t('write')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>

                <div className="flex flex-col items-center gap-2 w-28 text-center">
                    <button
                        onClick={() => startListening('target')}
                        className={`h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 ${
                            listeningFor === 'target' ? 'bg-red-500 animate-pulse' : 'bg-secondary'
                        } shadow-secondary/30`}
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </button>
                    <span className="text-xs font-medium text-gray-300 truncate">{targetLang.flag} {targetLang.name}</span>
                </div>
            </div>
        )}
      </footer>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sourceLang={sourceLang}
        targetLang={targetLang}
        setSourceLang={setSourceLang}
        setTargetLang={setTargetLang}
      />
    </div>
  );
};

const App: React.FC = () => {
    // Dil seçimlerini localStorage'dan okuyarak başlat
    const getInitialLanguage = (key: string, defaultId: string): Language => {
        const savedId = localStorage.getItem(key);
        return LANGUAGES.find(l => l.id === savedId) || LANGUAGES.find(l => l.id === defaultId) || LANGUAGES[0];
    };

    const [sourceLang, setSourceLang] = useState<Language>(() => getInitialLanguage('sourceLangId', 'tr-TR'));
    const [targetLang, setTargetLang] = useState<Language>(() => getInitialLanguage('targetLangId', 'en-US-TX'));

    // Dil seçimlerini localStorage'a kaydet
    useEffect(() => {
        localStorage.setItem('sourceLangId', sourceLang.id);
    }, [sourceLang]);

    useEffect(() => {
        localStorage.setItem('targetLangId', targetLang.id);
    }, [targetLang]);

    // Uygulama ilk yüklendiğinde konuma göre hedef dili ayarla
    useEffect(() => {
        const detectAndSetLanguage = async () => {
            if (!navigator.geolocation) {
                console.log("Geolocation is not supported by your browser.");
                return;
            }

            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                
                const languageId = await getLanguageFromLocation(latitude, longitude, LANGUAGES);

                if (languageId) {
                    const matchedLanguage = LANGUAGES.find(l => l.id === languageId);
                    if (matchedLanguage) {
                        setTargetLang(matchedLanguage);
                        console.log(`Location detected. Target language set to: ${matchedLanguage.name}`);
                    }
                }
            }, (error) => {
                console.error("Error getting location: ", error.message);
            });
        };

        detectAndSetLanguage();
    }, []); // Boş dependency array'i sayesinde sadece ilk render'da çalışır

    return (
        <LocalizationProvider language={sourceLang.id}>
            <AppContent 
                sourceLang={sourceLang} 
                setSourceLang={setSourceLang}
                targetLang={targetLang}
                setTargetLang={setTargetLang}
            />
        </LocalizationProvider>
    );
}

export default App;