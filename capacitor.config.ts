import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mechi.ydr',
  appName: 'MeChi',
  webDir: 'dist',
  backgroundColor: '#0f172a',
  plugins: {
    SystemBars: {
      // Güvenli alan değerlerini --safe-area-inset-* CSS değişkenleri olarak verir (index.css kullanır)
      insetsHandling: 'css',
      // Koyu arka plan üzerinde açık renkli durum çubuğu simgeleri
      style: 'DARK',
    },
  },
};

export default config;
