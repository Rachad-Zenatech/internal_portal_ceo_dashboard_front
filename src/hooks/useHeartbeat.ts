import { useEffect, useRef } from 'react';
import { apiClient } from '../services/apiClient';

export function useHeartbeat(isAuthenticated: boolean) {
  const lastActiveTimeRef = useRef<number>(Date.now());
  const throttleRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = () => {
      if (throttleRef.current) return;
      throttleRef.current = true;
      lastActiveTimeRef.current = Date.now();
      setTimeout(() => {
        throttleRef.current = false;
      }, 5000);
    };

    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);

    const interval = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActiveTimeRef.current;
      if (timeSinceLastActivity < 15 * 60 * 1000) {
        apiClient.post('/auth/heartbeat', {}, { timeoutMs: 1500 }).catch(() => {});
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, [isAuthenticated]);
}
