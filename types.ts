

export interface Language {
    id: string;
    name: string;
    flag: string; // Emoji
    speechCode: string; // BCP 47 code for Web Speech API
    country?: string;
    currency?: string;
}

export interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot' | 'system';
    language: string;
    timestamp: number;
    isAudio?: boolean;
}

export type InputMode = 'text' | 'voice' | 'idle';

export const LANGUAGES: Language[] = [
// A
  { id: 'de-DE-BAV', name: 'Almanca (Bavyera/Bayerisch)', flag: '🥨', speechCode: 'de-DE', country: 'Germany (Bavaria)', currency: 'EUR' },
  { id: 'de-AT', name: 'Almanca (Avusturya/Wienerisch)', flag: '🇦🇹', speechCode: 'de-AT', country: 'Austria', currency: 'EUR' },
  { id: 'de-CH', name: 'Almanca (İsviçre Almancası)', flag: '🇨🇭', speechCode: 'de-CH', country: 'Switzerland', currency: 'CHF' },
  { id: 'de-DE-STD', name: 'Almanca (Standart)', flag: '🇩🇪', speechCode: 'de-DE', country: 'Germany', currency: 'EUR' },
  { id: 'ar-MA', name: 'Arapça (Fas Lehçesi - Darija)', flag: '🇲🇦', speechCode: 'ar-MA', country: 'Morocco', currency: 'MAD' },
  { id: 'ar-IQ', name: 'Arapça (Irak Lehçesi)', flag: '🇮🇶', speechCode: 'ar-IQ', country: 'Iraq', currency: 'IQD' },
  { id: 'ar-LB', name: 'Arapça (Lübnan Lehçesi)', flag: '🇱🇧', speechCode: 'ar-LB', country: 'Lebanon', currency: 'LBP' },
  { id: 'ar-EG', name: 'Arapça (Mısır Lehçesi)', flag: '🇪🇬', speechCode: 'ar-EG', country: 'Egypt', currency: 'EGP' },
  { id: 'ar-SA', name: 'Arapça (Suudi Arabistan - Körfez)', flag: '🇸🇦', speechCode: 'ar-SA', country: 'Saudi Arabia', currency: 'SAR' },
  { id: 'ar-MSA', name: 'Arapça (Standart - Fusha)', flag: '📖', speechCode: 'ar-SA', country: 'Arab World', currency: 'SAR' },
  { id: 'az-AZ-BAK', name: 'Azerice (Bakü Lehçesi)', flag: '🏙️', speechCode: 'az-AZ', country: 'Azerbaijan', currency: 'AZN' },
  { id: 'az-IR-TAB', name: 'Azerice (Tebriz Lehçesi)', flag: '🇮🇷', speechCode: 'az-AZ', country: 'Iran', currency: 'IRR' },

  // B
  { id: 'bs-BA', name: 'Boşnakça (Bosanski)', flag: '🇧🇦', speechCode: 'bs-BA', country: 'Bosnia', currency: 'BAM' },

  // C - Ç
  { id: 'zh-HK', name: 'Çince (Kantonca - Hong Kong)', flag: '🇭🇰', speechCode: 'zh-HK', country: 'Hong Kong', currency: 'HKD' },
  { id: 'zh-CN', name: 'Çince (Mandarin - Standart)', flag: '🇨🇳', speechCode: 'zh-CN', country: 'China', currency: 'CNY' },
  { id: 'zh-TW', name: 'Çince (Tayvan Mandarini)', flag: '🇹🇼', speechCode: 'zh-TW', country: 'Taiwan', currency: 'TWD' },

  // D
  { id: 'da-DK', name: 'Danca (Dansk)', flag: '🇩🇰', speechCode: 'da-DK', country: 'Denmark', currency: 'DKK' },

  // E
  { id: 'id-JAV', name: 'Endonezce (Cava Dili)', flag: '🌋', speechCode: 'jv-ID', country: 'Indonesia', currency: 'IDR' },
  { id: 'id-ID', name: 'Endonezce (Standart)', flag: '🇮🇩', speechCode: 'id-ID', country: 'Indonesia', currency: 'IDR' },

  // F
  { id: 'fa-IR', name: 'Farsça (İran Lehçesi)', flag: '🇮🇷', speechCode: 'fa-IR', country: 'Iran', currency: 'IRR' },
  { id: 'fa-AF', name: 'Farsça (Dari - Afganistan)', flag: '🇦🇫', speechCode: 'fa-IR', country: 'Afghanistan', currency: 'AFN' },
  { id: 'fr-QC', name: 'Fransızca (Kanada/Québec)', flag: '🇨🇦', speechCode: 'fr-CA', country: 'Canada', currency: 'CAD' },
  { id: 'fr-FR', name: 'Fransızca (Standart)', flag: '🇫🇷', speechCode: 'fr-FR', country: 'France', currency: 'EUR' },

  // H
  { id: 'hi-STD', name: 'Hintçe (Standart)', flag: '🇮🇳', speechCode: 'hi-IN', country: 'India', currency: 'INR' },
  { id: 'hr-HR', name: 'Hırvatça (Hrvatski)', flag: '🇭🇷', speechCode: 'hr-HR', country: 'Croatia', currency: 'EUR' },

  // I - İ
  { id: 'en-AU', name: 'İngilizce (Avustralya)', flag: '🇦🇺', speechCode: 'en-AU', country: 'Australia', currency: 'AUD' },
  { id: 'en-UK-SCO', name: 'İngilizce (İskoç Lehçesi)', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', speechCode: 'en-GB', country: 'UK', currency: 'GBP' },
  { id: 'en-US-TX', name: 'İngilizce (Teksas/Güney)', flag: '🤠', speechCode: 'en-US', country: 'USA', currency: 'USD' },
  { id: 'es-ARG', name: 'İspanyolca (Arjantin Lehçesi)', flag: '🇦🇷', speechCode: 'es-AR', country: 'Argentina', currency: 'ARS' },
  { id: 'es-MEX', name: 'İspanyolca (Meksika Lehçesi)', flag: '🇲🇽', speechCode: 'es-MX', country: 'Mexico', currency: 'MXN' },
  { id: 'es-ES', name: 'İspanyolca (Standart - İspanya)', flag: '🇪🇸', speechCode: 'es-ES', country: 'Spain', currency: 'EUR' },
  { id: 'it-NAP', name: 'İtalyanca (Napoli Lehçesi)', flag: '🍕', speechCode: 'it-IT', country: 'Italy', currency: 'EUR' },
  { id: 'it-ROM', name: 'İtalyanca (Standart - Roma)', flag: '🏛️', speechCode: 'it-IT', country: 'Italy', currency: 'EUR' },

  // J
  { id: 'jp-KYOT', name: 'Japonca (Kyoto Lehçesi)', flag: '🌸', speechCode: 'ja-JP', country: 'Japan', currency: 'JPY' },
  { id: 'jp-TOK', name: 'Japonca (Standart - Tokyo)', flag: '🇯🇵', speechCode: 'ja-JP', country: 'Japan', currency: 'JPY' },

  // K
  { id: 'ko-BUS', name: 'Korece (Busan Lehçesi)', flag: '⚓', speechCode: 'ko-KR', country: 'South Korea', currency: 'KRW' },
  { id: 'ko-SEO', name: 'Korece (Standart - Seul)', flag: '🇰🇷', speechCode: 'ko-KR', country: 'South Korea', currency: 'KRW' },
  { id: 'ku-KUR', name: 'Kürtçe (Kurmanci)', flag: '☀️', speechCode: 'tr-TR', country: 'Turkey/Syria', currency: 'TRY' },
  { id: 'ku-SOR', name: 'Kürtçe (Sorani)', flag: '📜', speechCode: 'ar-IQ', country: 'Iraq/Iran', currency: 'IQD' },
  { id: 'ku-ZAZ', name: 'Kürtçe (Zazaca)', flag: '🏔️', speechCode: 'tr-TR', country: 'Turkey', currency: 'TRY' },

  // N
  { id: 'no-NO', name: 'Norveççe (Bokmål)', flag: '🇳🇴', speechCode: 'nb-NO', country: 'Norway', currency: 'NOK' },

  // P
  { id: 'pt-BR', name: 'Portekizce (Brezilya)', flag: '🇧🇷', speechCode: 'pt-BR', country: 'Brazil', currency: 'BRL' },
  { id: 'pt-PT', name: 'Portekizce (Standart)', flag: '🇵🇹', speechCode: 'pt-PT', country: 'Portugal', currency: 'EUR' },

  // R
  { id: 'ru-BY', name: 'Rusça (Belarus Aksanı)', flag: '🇧🇾', speechCode: 'ru-RU', country: 'Belarus', currency: 'BYN' },
  { id: 'ru-MOS', name: 'Rusça (Standart - Moskova)', flag: '🇷🇺', speechCode: 'ru-RU', country: 'Russia', currency: 'RUB' },
  { id: 'ru-UKR', name: 'Rusça (Ukrayna Aksanı)', flag: '🇺🇦', speechCode: 'ru-UA', country: 'Ukraine', currency: 'UAH' },

  // S
  { id: 'sr-RS', name: 'Sırpça (Srpski)', flag: '🇷🇸', speechCode: 'sr-RS', country: 'Serbia', currency: 'RSD' },
  { id: 'sv-SE', name: 'İsveççe (Svenska)', flag: '🇸🇪', speechCode: 'sv-SE', country: 'Sweden', currency: 'SEK' },

  // T
  { id: 'tr-TR', name: 'Türkçe (Standart)', flag: '🇹🇷', speechCode: 'tr-TR', country: 'Turkey', currency: 'TRY' }
  
  ];