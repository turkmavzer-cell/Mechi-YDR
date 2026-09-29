import { Language } from "../types";

// Web'de (Vercel / AI Studio) boş kalır ve istekler aynı sunucuya gider.
// APK'da VITE_API_BASE, Vercel'deki sunucunun tam adresidir (ör. https://mechi-ydr.vercel.app).
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const APP_KEY = import.meta.env.VITE_APP_KEY || "";

const apiFetch = (path: string, init: RequestInit) =>
    fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(APP_KEY ? { "x-app-key": APP_KEY } : {}),
        },
    });

export const translateText = async (
    text: string, 
    sourceLang: string, 
    targetLang: string
): Promise<string> => {
    try {
        const response = await apiFetch("/api/translate", {
            method: "POST",
            body: JSON.stringify({ text, sourceLang, targetLang })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.translation || "Çeviri hatası oluştu.";
    } catch (error) {
        console.error("Translation error:", error);
        return "Bağlantı hatası. Lütfen tekrar deneyin.";
    }
};

export interface LocationDetails {
    latitude: number;
    longitude: number;
    city?: string;
    district?: string;
    neighborhood?: string;
    fullAddress?: string;
}

export const getAddressFromCoordinates = async (
    latitude: number,
    longitude: number
): Promise<{ city: string; district: string; neighborhood: string; fullAddress: string } | null> => {
    try {
        const response = await apiFetch("/api/reverse-geocode", {
            method: "POST",
            body: JSON.stringify({ latitude, longitude })
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("Reverse geocoding error:", e);
        return null;
    }
};

export const getConsulateInfo = async (
    targetLang: Language,
    sourceLang: Language,
    location?: { latitude: number; longitude: number }
): Promise<{ phone: string, mapLink: string, address: string, title: string } | null> => {
    try {
        const response = await apiFetch("/api/consulate", {
            method: "POST",
            body: JSON.stringify({ targetLang, sourceLang, location })
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Consulate info generation error:", error);
        return null;
    }
};

export const getLanguageFromLocation = async (
    latitude: number,
    longitude: number,
    availableLanguages: Language[]
): Promise<string | null> => {
    try {
        const response = await apiFetch("/api/language-from-location", {
            method: "POST",
            body: JSON.stringify({ latitude, longitude, availableLanguages })
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.languageId || null;
    } catch (error) {
        console.error("Error getting language from location:", error);
        return null;
    }
};

// Lehçeli seslendirme: WAV sesi base64 olarak döner, hata olursa null
export const fetchDialectSpeech = async (text: string, lang: Language): Promise<string | null> => {
    try {
        const response = await apiFetch("/api/speak", {
            method: "POST",
            body: JSON.stringify({ text, languageId: lang.id, languageName: lang.name, country: lang.country })
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.audio || null;
    } catch (error) {
        console.error("Dialect speech error:", error);
        return null;
    }
};

export interface ConverseResult {
    speaker: 'A' | 'B' | 'none';
    transcript: string;
    translation: string;
}

// Sohbet modu: ses parçasını (16 kHz WAV, base64) gönderir; konuşulan dili bulup diğer dile çevirir
export const converseAudio = async (
    audioWavBase64: string,
    langA: Language,
    langB: Language
): Promise<ConverseResult | null> => {
    try {
        const pick = (l: Language) => ({ id: l.id, name: l.name, country: l.country });
        const response = await apiFetch("/api/converse", {
            method: "POST",
            body: JSON.stringify({ audio: audioWavBase64, langA: pick(langA), langB: pick(langB) })
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Converse error:", error);
        return null;
    }
};