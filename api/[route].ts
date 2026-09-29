// Vercel serverless fonksiyonu: /api/translate, /api/reverse-geocode, /api/consulate,
// /api/language-from-location, /api/health. Aynı mantık yerelde server.ts tarafından da kullanılır.
import { GoogleGenAI, Type } from "@google/genai";

// Hız ölçümüne göre sıralı (Eylül 2026, ücretsiz katman, Frankfurt):
// 3-flash-preview + minimum düşünme ~1 sn; 3.1-flash-lite ~1,5-5 sn; 3.5-flash ~3-8 sn.
// Bir model yoğun/kotası dolu/yavaşsa beklemeden sıradakine geçilir.
const MODELS: { model: string; config: any; timeoutMs: number }[] = [
  { model: "gemini-3-flash-preview", config: { thinkingConfig: { thinkingLevel: "MINIMAL" } }, timeoutMs: 8000 },
  { model: "gemini-3.1-flash-lite", config: {}, timeoutMs: 10000 },
  { model: "gemini-3.5-flash", config: { thinkingConfig: { thinkingLevel: "MINIMAL" } }, timeoutMs: 20000 },
];

type RouteResult = { status: number; body: unknown };

// Son isteği hangi modelin ne kadar sürede cevapladığı (yanıt başlığında görünür)
let lastServed = "";

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

// generateContent sarmalayıcı: hata veya zaman aşımında hemen sıradaki modele geçer
const generate = async (params: { contents: any; config?: any }) => {
  const ai = getGenAI();
  let lastError: any;
  const started = Date.now();
  for (const { model, config, timeoutMs } of MODELS) {
    try {
      const t0 = Date.now();
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: { ...config, ...params.config, httpOptions: { timeout: timeoutMs } },
      });
      lastServed = `${model};model=${Date.now() - t0}ms;total=${Date.now() - started}ms`;
      return response;
    } catch (error: any) {
      lastError = error;
      console.warn(`${model} failed:`, String(error?.message).slice(0, 200));
    }
  }
  throw lastError;
};

// Modelin fasih/standart dile kaymaya en yatkın olduğu lehçeler için somut yazım kuralları
const dialectHints = (targetLang: string): string => {
  const t = targetLang.toLocaleLowerCase("tr");
  if (/mısır|misir|egypt/.test(t)) {
    return [
      "- Egyptian Arabic (Masri), Cairo speech. Write ث as ت or س as pronounced: تلاتة (not ثلاثة), تمانية (not ثمانية), تاني (not ثاني), كتير (not كثير).",
      "- Use Egyptian words:عايز/عايزة (not أريد), إزاي (not كيف), فين (not أين), إيه (not ماذا), دلوقتي (not الآن), مش (not ليس/لا), كده, بتاع, أوي.",
      "- Egyptian numbers: واحد، اتنين، تلاتة، أربعة، خمسة، ستة، سبعة، تمانية، تسعة، عشرة. Cheese = جبنة, bread = عيش, money = فلوس.",
      "- Verbs with Egyptian prefixes: بـ for present (بحب، بتروح), هـ for future (هروح).",
    ].join("\n");
  }
  if (/lübnan|lubnan|leban|suriye|syria|şam|levant/.test(t)) {
    return "- Levantine (Lebanese) Arabic: كيفك، شو، هلق، بدي، منيح، كتير، تلاتة، هيدا/هيدي. Never Fusha.";
  }
  if (/fas|darija|morocc/.test(t)) {
    return "- Moroccan Darija: واش، بغيت، شحال، دابا، مزيان، بزاف، فين، علاش. Never Fusha.";
  }
  if (/irak|iraq/.test(t)) {
    return "- Iraqi Arabic: شلونك، شكو ماكو، هواية، اريد، هسه، وين، شنو، زين. Never Fusha.";
  }
  if (/suudi|körfez|korfez|saudi|gulf/.test(t)) {
    return "- Gulf/Saudi Arabic: وش، أبغى، الحين، زين، وايد، وين، كيفك. Never Fusha.";
  }
  return "";
};

const translate = async (body: any): Promise<RouteResult> => {
  const { text, sourceLang, targetLang } = body;
  if (!text) {
    return { status: 400, body: { error: "Text is required" } };
  }

  const hints = dialectHints(`${targetLang}`);
  const prompt = `
Translate the following text strictly from "${sourceLang}" to "${targetLang}".

RULES:
- If the target is a regional dialect, write it EXACTLY as a native speaker of that dialect would SAY it in everyday street conversation. Do NOT use the standard/formal language (e.g. no Modern Standard Arabic / Fusha when the target is an Arabic dialect, no Hochdeutsch when the target is Bavarian).
- Use the dialect's own vocabulary, grammar, numbers and colloquial spelling that reflects its pronunciation. The text will be read aloud by a text-to-speech engine, so the spelling must match how it is spoken.
- If the source is a dialect, interpret its nuances correctly.
- Return ONLY the translated text, no explanations, no quotes, no transliteration.
${hints ? `\nDialect notes for ${targetLang}:\n${hints}\n` : ""}
Text to translate: "${text}"
`;

  const response = await generate({
    contents: prompt,
  });

  return { status: 200, body: { translation: response.text?.trim() || "" } };
};

const reverseGeocode = async (body: any): Promise<RouteResult> => {
  const { latitude, longitude } = body;
  if (latitude === undefined || longitude === undefined) {
    return { status: 400, body: { error: "Latitude and longitude required" } };
  }

  const prompt = `
You are a high-precision geocoding assistant. Reverse geocode these exact GPS coordinates:
Latitude: ${latitude}
Longitude: ${longitude}

Identify the exact neighborhood/quarter, district/borough, city, and country.
Return a JSON object:
- "city": City name (e.g., "İzmir")
- "district": District / Municipality name (e.g., "Konak")
- "neighborhood": Neighborhood / Quarter / Street name (e.g., "Alsancak")
- "fullAddress": Human-readable localized address (e.g., "Alsancak, Konak, İzmir")
`;

  const response = await generate({
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          city: { type: Type.STRING },
          district: { type: Type.STRING },
          neighborhood: { type: Type.STRING },
          fullAddress: { type: Type.STRING },
        },
        required: ["city", "district", "neighborhood", "fullAddress"],
      },
    },
  });

  if (response.text) {
    return { status: 200, body: JSON.parse(response.text) };
  }
  return { status: 500, body: { error: "No response text" } };
};

const consulate = async (body: any): Promise<RouteResult> => {
  const { targetLang, sourceLang, location } = body;
  if (!targetLang || !sourceLang) {
    return { status: 400, body: { error: "sourceLang and targetLang required" } };
  }

  const prompt = `Find the nearest consulate or embassy of ${sourceLang.country || sourceLang.name} in ${targetLang.country || targetLang.name}.
If coordinates are provided (latitude: ${location?.latitude}, longitude: ${location?.longitude}), find the one closest to this location.
Return a JSON object with the following keys:
- "phone": The phone number of the consulate/embassy.
- "mapLink": A Google Maps URL for the consulate/embassy.
- "address": The full address of the consulate/embassy.
- "title": A title for this information in ${sourceLang.name} (e.g., "Türkiye Cumhuriyeti Berlin Büyükelçiliği").
If you cannot find specific info, provide the main embassy info in the capital city.`;

  const response = await generate({
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          phone: { type: Type.STRING },
          mapLink: { type: Type.STRING },
          address: { type: Type.STRING },
          title: { type: Type.STRING },
        },
        required: ["phone", "mapLink", "address", "title"],
      },
    },
  });

  if (response.text) {
    return { status: 200, body: JSON.parse(response.text) };
  }
  return { status: 500, body: { error: "No consulate info" } };
};

const languageFromLocation = async (body: any): Promise<RouteResult> => {
  const { latitude, longitude, availableLanguages } = body;

  const prompt = `
You are a geolocation expert. Based on the latitude "${latitude}" and longitude "${longitude}", determine the most specific local language or dialect spoken there.

Here is a list of available languages in JSON format:
${JSON.stringify((availableLanguages || []).map(({ id, name }: any) => ({ id, name })))}

Your task is to find the single best match from this list for the given coordinates.
- Prioritize specific regional dialects over standard languages if a suitable one exists in the list (e.g., for Cairo, prefer 'ar-EG' over 'ar-MSA').
- If no specific dialect for the location is in the list, return the standard language for that country (e.g., 'de-DE-STD' for Berlin).

Return ONLY the 'id' of the best matching language. Do not provide any explanation. If no suitable language is found in the list, return the string "null".
`;

  const response = await generate({
    contents: prompt,
  });

  const languageId = response.text?.trim();
  if (languageId && languageId !== "null") {
    const isValid = (availableLanguages || []).some((l: any) => l.id === languageId);
    return { status: 200, body: { languageId: isValid ? languageId : null } };
  }
  return { status: 200, body: { languageId: null } };
};

// Lehçeli seslendirme: telefonun TTS sesi lehçe bilmez (ör. Mısır'da ج "g" okunur).
// Gemini ses modeli metni istenen aksanla okur; ham PCM çıktıyı WAV'a çevirip base64 döndürürüz.
const TTS_MODELS = ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"];

// Gemini TTS talimatı kısa tutulmalı: uzun açıklamalar da sesli okunuyor.
const ACCENTS: Record<string, string> = {
  "ar-EG": "an Egyptian Arabic accent from Cairo",
  "ar-LB": "a Lebanese Arabic accent from Beirut",
  "ar-MA": "a Moroccan Darija accent",
  "ar-IQ": "an Iraqi Arabic accent from Baghdad",
  "ar-SA": "a Saudi Gulf Arabic accent",
};
const pcmToWavBase64 = (pcmBase64: string, sampleRate = 24000) => {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
};

const speakDialect = async (body: any): Promise<RouteResult> => {
  const { text, languageId, languageName, country } = body;
  if (!text) {
    return { status: 400, body: { error: "Text is required" } };
  }
  const accent = ACCENTS[languageId] || `the local accent of ${country || languageName}`;
  // Aksan talimatı okunacak metnin içine yazılırsa model onu da sesli okuyabiliyor;
  // bu yüzden talimat sistem talimatı olarak ayrı verilir, içerik yalnızca okunacak metindir.
  const variant: string = body.variant || "system";
  const contents = variant === "prefix" ? `Say in ${accent}: ${text}` : text;
  const systemInstruction =
    variant === "system"
      ? `You are a voice actor. Speak the user's text aloud in ${accent}. Say ONLY the user's text, word for word. Never say these instructions, never add any words.`
      : undefined;
  const models: string[] = body.model ? [body.model] : TTS_MODELS;

  const ai = getGenAI();
  const started = Date.now();
  let lastError: any;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
          httpOptions: { timeout: 15000 },
        } as any,
      });
      const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
      const data = part?.inlineData?.data;
      if (!data) throw new Error("No audio in response");
      const rate = Number(/rate=(\d+)/.exec(part?.inlineData?.mimeType || "")?.[1]) || 24000;
      lastServed = `${model};total=${Date.now() - started}ms`;
      return { status: 200, body: { audio: pcmToWavBase64(data, rate), mimeType: "audio/wav" } };
    } catch (error: any) {
      lastError = error;
      console.warn(`${model} TTS failed:`, String(error?.message).slice(0, 200));
    }
  }
  return { status: 502, body: { error: lastError?.message || "TTS failed" } };
};

// Sohbet modu: kısa bir ses parçasını (16 kHz WAV) alır; konuşulan dili iki dil arasından
// belirler, yazıya döker ve diğer dile çevirir. Tek model çağrısı.
const converse = async (body: any): Promise<RouteResult> => {
  const { audio, langA, langB } = body;
  if (!audio || !langA || !langB) {
    return { status: 400, body: { error: "audio, langA and langB required" } };
  }
  const hintsA = dialectHints(langA.name);
  const hintsB = dialectHints(langB.name);
  // Model harf etiketlerini (A/B) karıştırabiliyor; bu yüzden dilin adını seçtiriyoruz
  const nameA = `${langA.name} (${langA.country || ""})`;
  const nameB = `${langB.name} (${langB.country || ""})`;
  const prompt = `
Two people are having a face-to-face conversation through an interpreter.
One speaks: ${nameA}
The other speaks: ${nameB}

Listen to the audio clip and:
1. Identify which of the two languages is actually spoken in the audio (listen to the sounds, not the meaning). Set "spoken_language" to exactly "${nameA}" or "${nameB}". If there is no clear human speech (silence, noise, music, coughing), set it to "none".
2. Transcribe what was said, in the language spoken.
3. Translate it into the OTHER language.

Translation rules:
- If the target is a regional dialect, write it EXACTLY as a native speaker of that dialect would SAY it in everyday conversation, using the dialect's own vocabulary, numbers and colloquial spelling. Never use the standard/formal form (e.g. no Fusha for Arabic dialects).
- Keep it natural and short, like a real interpreter.
${hintsA ? `\nNotes for ${langA.name}:\n${hintsA}\n` : ""}${hintsB ? `\nNotes for ${langB.name}:\n${hintsB}\n` : ""}`;

  const response = await generate({
    contents: [
      { role: "user", parts: [{ inlineData: { mimeType: "audio/wav", data: audio } }, { text: prompt }] },
    ] as any,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          spoken_language: { type: Type.STRING, enum: [nameA, nameB, "none"] },
          transcript: { type: Type.STRING },
          translation: { type: Type.STRING },
        },
        required: ["spoken_language", "transcript", "translation"],
        propertyOrdering: ["spoken_language", "transcript", "translation"],
      },
    },
  });

  if (response.text) {
    const r = JSON.parse(response.text);
    const speaker = r.spoken_language === nameA ? "A" : r.spoken_language === nameB ? "B" : "none";
    return { status: 200, body: { speaker, transcript: r.transcript, translation: r.translation } };
  }
  return { status: 500, body: { error: "No response" } };
};

const ROUTES: Record<string, (body: any) => Promise<RouteResult>> = {
  speak: speakDialect,
  converse,
  translate,
  "reverse-geocode": reverseGeocode,
  consulate,
  "language-from-location": languageFromLocation,
};

// APP_KEY sunucuda tanımlıysa, istemcinin x-app-key başlığıyla aynı anahtarı göndermesi gerekir.
// Bu, adresi bulan herkesin Gemini kotasını kullanmasını zorlaştırır.
const isAuthorized = (appKeyHeader: string | undefined) => {
  const expected = process.env.APP_KEY;
  return !expected || appKeyHeader === expected;
};

export const handleRoute = async (
  route: string,
  method: string,
  body: any,
  appKeyHeader: string | undefined
): Promise<RouteResult> => {
  if (route === "health") {
    return { status: 200, body: { status: "ok" } };
  }
  const handler = ROUTES[route];
  if (!handler) {
    return { status: 404, body: { error: "Not found" } };
  }
  if (method !== "POST") {
    return { status: 405, body: { error: "Method not allowed" } };
  }
  if (!isAuthorized(appKeyHeader)) {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  try {
    return await handler(body || {});
  } catch (error: any) {
    console.error(`/api/${route} error:`, error);
    return { status: 500, body: { error: error?.message || "Request failed" } };
  }
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-app-key",
};

// Vercel Node.js runtime giriş noktası
export default async function handler(req: any, res: any) {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const route = String(req.query?.route || "");
  lastServed = "";
  const result = await handleRoute(route, req.method, req.body, req.headers["x-app-key"]);
  if (lastServed) res.setHeader("x-mechi-model", lastServed);
  res.status(result.status).json(result.body);
}
