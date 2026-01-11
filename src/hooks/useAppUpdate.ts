import { useEffect, useCallback, useRef } from 'react';

const CHECK_INTERVAL = 30000; // Проверять каждые 30 секунд
const VERSION_KEY = 'app_version';

export const useAppUpdate = () => {
  const lastCheckRef = useRef<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    try {
      // Запрашиваем index.html с cache-bust параметром
      const response = await fetch(`/?_=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) return;
      
      const html = await response.text();
      
      // Ищем хэш скриптов в HTML (они меняются при каждой сборке)
      const scriptMatch = html.match(/src="\/assets\/index-([a-zA-Z0-9]+)\.js"/);
      const currentHash = scriptMatch?.[1] || '';
      
      if (!currentHash) return;
      
      const storedVersion = localStorage.getItem(VERSION_KEY);
      
      if (!storedVersion) {
        // Первый запуск - сохраняем текущую версию
        localStorage.setItem(VERSION_KEY, currentHash);
        lastCheckRef.current = currentHash;
        return;
      }
      
      if (storedVersion !== currentHash && lastCheckRef.current !== currentHash) {
        console.log('🔄 Обнаружена новая версия, перезагрузка...');
        localStorage.setItem(VERSION_KEY, currentHash);
        window.location.reload();
      }
      
      lastCheckRef.current = currentHash;
    } catch (error) {
      console.error('Ошибка проверки обновлений:', error);
    }
  }, []);

  useEffect(() => {
    // Проверяем сразу при загрузке
    checkForUpdates();
    
    // Устанавливаем интервал проверки
    const interval = setInterval(checkForUpdates, CHECK_INTERVAL);
    
    // Также проверяем при возвращении на вкладку
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdates]);
};
