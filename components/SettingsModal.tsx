import React, { useState, useMemo, useEffect } from 'react';
import { LANGUAGES, Language } from '../types';
import { getConsulateInfo, getAddressFromCoordinates, LocationDetails, lastRequestHitQuota } from '../services/geminiService';
import { useLocalization } from '../lib/i18n';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceLang: Language;
    targetLang: Language;
    setSourceLang: (l: Language) => void;
    setTargetLang: (l: Language) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    sourceLang,
    targetLang,
    setSourceLang,
    setTargetLang
}) => {
    const [activeSelector, setActiveSelector] = useState<'source' | 'target' | null>(null);
    const [consulateInfo, setConsulateInfo] = useState<{ phone: string, mapLink: string, address: string, title: string } | null>(null);
    const [loadingInfo, setLoadingInfo] = useState(false);
    const [infoError, setInfoError] = useState<string | null>(null);

    const [locationDetails, setLocationDetails] = useState<LocationDetails | null>(null);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [locationStatusMessage, setLocationStatusMessage] = useState<string | null>(null);
    
    const { t } = useLocalization();

    const getUserPinpointLocation = async (): Promise<LocationDetails | undefined> => {
        setDetectingLocation(true);
        setLocationStatusMessage(t('detectingLocation'));
        
        try {
            const coords = await new Promise<{ latitude: number, longitude: number }>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("Geolocation is not supported by your browser."));
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (position) => resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    }),
                    (error) => reject(error),
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    }
                );
            });

            // Perform reverse geocoding to get pinpoint neighborhood / district
            const addrInfo = await getAddressFromCoordinates(coords.latitude, coords.longitude);
            const details: LocationDetails = {
                latitude: coords.latitude,
                longitude: coords.longitude,
                city: addrInfo?.city,
                district: addrInfo?.district,
                neighborhood: addrInfo?.neighborhood,
                fullAddress: addrInfo?.fullAddress || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
            };

            setLocationDetails(details);
            setLocationStatusMessage(null);
            setDetectingLocation(false);
            return details;
        } catch (error) {
            console.error("Geolocation pinpoint error:", error);
            setLocationStatusMessage(t('locationError'));
            setDetectingLocation(false);
            return undefined;
        }
    };

    const handleConsulateRequest = async () => {
        setLoadingInfo(true);
        setConsulateInfo(null);
        setInfoError(null);

        const location = locationDetails || await getUserPinpointLocation();
        const data = await getConsulateInfo(targetLang, sourceLang, location);
        
        if (data) {
            setConsulateInfo(data);
        } else {
            setInfoError(lastRequestHitQuota() ? t('quotaExceeded') : t('guideError'));
        }
        
        setLoadingInfo(false);
    };

    const handleLanguageSelect = (lang: Language) => {
        if (activeSelector === 'source') setSourceLang(lang);
        else if (activeSelector === 'target') {
            setTargetLang(lang);
            setConsulateInfo(null);
            setInfoError(null);
        }
        
        setTimeout(() => {
            setActiveSelector(null);
        }, 300);
    };

    if (!isOpen) return null;

    const renderConsulateContent = () => {
        if (!consulateInfo) return null;

        return (
            <div className="space-y-4">
                <div className="bg-dark/50 p-3 rounded-lg flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                        <span className="text-xl">📍</span>
                        <p className="text-sm text-gray-300 flex-1">{consulateInfo.address}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📞</span>
                        <a href={`tel:${consulateInfo.phone}`} className="text-sm font-mono font-bold text-primary hover:underline">{consulateInfo.phone}</a>
                    </div>
                </div>
                <a href={consulateInfo.mapLink} target="_blank" rel="noopener noreferrer" className="w-full flex justify-center items-center gap-2 bg-primary text-white font-bold py-3 px-4 rounded-xl hover:bg-primary/80 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>{t('goToLocation')}</span>
                </a>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex flex-col animate-fade-in safe-top">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">{t('settingsTitle')}</h2>
                <button onClick={onClose} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                <div className="space-y-2">
                    <p className="text-sm text-gray-400 text-center">{t('tapToChange')}</p>
                    <div className="flex gap-4 h-32">
                        <div 
                            className={`flex-1 bg-surface rounded-xl p-4 flex flex-col items-center justify-center border-2 cursor-pointer transition-all active:scale-95 select-none ${activeSelector === 'source' ? 'border-primary shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'border-gray-700'}`}
                            onClick={() => setActiveSelector('source')}
                        >
                            <span className="text-sm text-gray-400 mb-2">{t('yourLanguage')}</span>
                            <span className="text-4xl mb-2">{sourceLang.flag}</span>
                            <span className="text-center font-semibold text-sm leading-tight">{sourceLang.name}</span>
                        </div>

                        <div className="flex flex-col justify-center text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                        </div>

                        <div 
                            className={`flex-1 bg-surface rounded-xl p-4 flex flex-col items-center justify-center border-2 cursor-pointer transition-all active:scale-95 select-none ${activeSelector === 'target' ? 'border-secondary shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'border-gray-700'}`}
                            onClick={() => setActiveSelector('target')}
                        >
                            <span className="text-sm text-gray-400 mb-2">{t('targetLanguage')}</span>
                            <span className="text-4xl mb-2">{targetLang.flag}</span>
                            <span className="text-center font-semibold text-sm leading-tight">{targetLang.name}</span>
                        </div>
                    </div>
                </div>

                {/* --- CONSULATE INFO SECTION --- */}
                <div className="bg-surface rounded-2xl p-4 border border-gray-700 space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                        <span>🏛️</span> {sourceLang.country || sourceLang.name} {t('consulate')}
                    </h3>
                    
                    <button onClick={handleConsulateRequest} className="w-full bg-dark/50 p-3 rounded-xl text-sm text-center hover:bg-primary/20 transition active:scale-95 text-gray-200 font-medium border border-gray-600">
                        {t('getInfo')}
                    </button>

                    <div className="bg-dark/30 rounded-lg p-4 min-h-[100px] flex items-center justify-center">
                        {loadingInfo ? (
                             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        ) : infoError ? (
                            <p className="text-red-400 text-sm text-center">{infoError}</p>
                        ) : consulateInfo ? (
                             <div className="w-full space-y-3">
                                <h4 className="font-bold text-center text-primary">{consulateInfo.title}</h4>
                                {renderConsulateContent()}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm">{t('tapToGetInfo')}</p>
                        )}
                    </div>
                </div>
            </div>

            {activeSelector && (
                <div className="fixed inset-0 z-50 flex flex-col bg-dark/95 backdrop-blur-md animate-fade-in safe-top">
                    <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-surface/50">
                        <h3 className="text-lg font-bold text-gray-100">{activeSelector === 'source' ? t('selectSource') : t('selectTarget')}</h3>
                         <button onClick={() => setActiveSelector(null)} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4"><GroupedLanguagePicker items={LANGUAGES} selectedId={activeSelector === 'source' ? sourceLang.id : targetLang.id} onSelect={handleLanguageSelect}/></div>
                </div>
            )}
        </div>
    );
};

interface GroupedLanguagePickerProps {
    items: Language[];
    selectedId: string;
    onSelect: (item: Language) => void;
}

const GroupedLanguagePicker: React.FC<GroupedLanguagePickerProps> = ({ items, selectedId, onSelect }) => {
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const groupedItems = useMemo(() => {
        const groups: Record<string, Language[]> = {};
        items.forEach(item => {
            const rootCode = item.id.split('-')[0];
            if (!groups[rootCode]) groups[rootCode] = [];
            groups[rootCode].push(item);
        });
        return Object.entries(groups).sort((a, b) => a[1][0].name.localeCompare(b[1][0].name));
    }, [items]);

    const toggleGroup = (rootCode: string) => { setExpandedGroups(prev => prev.includes(rootCode) ? prev.filter(c => c !== rootCode) : [...prev, rootCode]); };
    const getGroupDisplayName = (lang: Language) => lang.name.split(' ')[0];

    return (
        <div className="space-y-3 pb-10">
            {groupedItems.map(([rootCode, groupLangs]) => {
                const isGroup = groupLangs.length > 1;
                const isExpanded = expandedGroups.includes(rootCode);
                const hasSelection = groupLangs.some(l => l.id === selectedId);
                const firstLang = groupLangs[0];
                const groupName = getGroupDisplayName(firstLang);

                if (!isGroup) {
                    const lang = groupLangs[0];
                    const isSelected = lang.id === selectedId;
                    return (
                        <button key={lang.id} onClick={() => onSelect(lang)} className={`w-full text-left p-4 rounded-xl border flex items-center gap-3 transition-all active:scale-98 ${isSelected ? 'bg-primary/20 border-primary shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-surface border-gray-700 hover:border-gray-500'}`}>
                            <span className="text-2xl">{lang.flag}</span>
                            <span className={`flex-1 font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>{lang.name}</span>
                            {isSelected && <span className="text-primary">●</span>}
                        </button>
                    );
                }

                return (
                    <div key={rootCode} className={`rounded-xl border transition-all duration-300 overflow-hidden ${hasSelection ? 'border-primary/50 bg-primary/5' : 'border-gray-700 bg-surface'}`}>
                        <button onClick={() => toggleGroup(rootCode)} className="w-full text-left p-4 flex items-center justify-between hover:bg-white/5 transition">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">{firstLang.flag}</span>
                                <span className="font-bold text-gray-200 text-lg">{groupName}</span>
                                <span className="text-xs text-gray-500 bg-black/30 px-2 py-0.5 rounded-full">{groupLangs.length} lehçe</span>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        </button>
                        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                            <div className="p-2 pt-0 space-y-1">
                                {groupLangs.map((lang) => {
                                    const isSelected = lang.id === selectedId;
                                    return (
                                        <button key={lang.id} onClick={() => onSelect(lang)} className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition active:scale-98 pl-6 ${isSelected ? 'bg-primary text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}>
                                            <span className="text-lg">{lang.flag}</span>
                                            <span className="text-sm font-medium truncate">{lang.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default SettingsModal;
