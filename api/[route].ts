// Vercel serverless fonksiyonu: /api/translate, /api/reverse-geocode, /api/consulate,
// /api/language-from-location, /api/health. Aynı mantık yerelde server.ts tarafından da kullanılır.
import { GoogleGenAI, Type } from "@google/genai";

// Ana model yoğun (503) veya kota dolu (429) ise sıradaki modele geçilir.
const MODELS = ["gemini-3.6-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

type RouteResult = { status: number; body: unknown };

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};

const isRetryable = (error: any) => {
  const text = `${error?.status ?? ""} ${error?.message ?? ""}`;
  return /\b(503|429|404|500)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|overloaded|high demand/i.test(text);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// generateContent sarmalayıcı: her model için bir yeniden deneme, sonra yedek modele geçiş
const generate = async (params: { contents: string; config?: any }) => {
  const ai = getGenAI();
  let lastError: any;
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ model, ...params });
      } catch (error: any) {
        lastError = error;
        if (!isRetryable(error)) throw error;
        console.warn(`${model} attempt ${attempt + 1} failed:`, error?.message);
        if (attempt === 0) await sleep(700);
      }
    }
  }
  throw lastError;
};

const translate = async (body: any): Promise<RouteResult> => {
  const { text, sourceLang, targetLang } = body;
  if (!text) {
    return { status: 400, body: { error: "Text is required" } };
  }

  const prompt = `
Translate the following text strictly from "${sourceLang}" to "${targetLang}".

IMPORTANT:
- If the target is a specific dialect (e.g., Aegean Turkish, Egyptian Arabic), usage of local idioms, slang, and specific tone is MANDATORY.
- If the source is a dialect, interpret the nuances correctly.
- Return ONLY the translated text, no explanations.

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

// GEÇİCİ teşhis: modelleri ve düşünme ayarlarını aynı cümleyle yarıştırır
const diag = async (): Promise<RouteResult> => {
  const ai = getGenAI();
  const names: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.name && /flash/i.test(m.name)) names.push(m.name.replace("models/", ""));
    }
  } catch (e: any) {
    names.push(`list-error: ${e?.message}`);
  }
  const candidates = Array.from(new Set([...MODELS, ...names.filter((n) => !/image|tts|audio|live|preview-0|exp/i.test(n))])).slice(0, 8);
  const configs: Record<string, any> = {
    default: {},
    minimal: { thinkingConfig: { thinkingLevel: "MINIMAL" } },
    budget0: { thinkingConfig: { thinkingBudget: 0 } },
  };
  const contents = 'Translate from Turkish to German. Return ONLY the translation: "Merhaba, en yakın eczane nerede?"';
  const jobs = candidates.flatMap((model) =>
    Object.entries(configs).map(async ([cfgName, config]) => {
      const t0 = Date.now();
      try {
        const r = await ai.models.generateContent({
          model,
          contents,
          config: { ...config, httpOptions: { timeout: 25000 } },
        });
        return { model, cfg: cfgName, ms: Date.now() - t0, ok: true, out: r.text?.trim().slice(0, 60) };
      } catch (e: any) {
        return { model, cfg: cfgName, ms: Date.now() - t0, ok: false, out: String(e?.message).slice(0, 120) };
      }
    })
  );
  return { status: 200, body: { region: process.env.VERCEL_REGION, models: names, results: await Promise.all(jobs) } };
};

const ROUTES: Record<string, (body: any) => Promise<RouteResult>> = {
  diag,
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
  const result = await handleRoute(route, req.method, req.body, req.headers["x-app-key"]);
  res.status(result.status).json(result.body);
}
