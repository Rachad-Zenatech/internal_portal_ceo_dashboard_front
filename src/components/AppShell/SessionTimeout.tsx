import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/services/apiClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timer, AlertTriangle } from "lucide-react";


const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const COUNTDOWN_MS = 5 * 60 * 1000; // 5 minutes (Total 15 mins)

export default function SessionTimeout() {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_MS);
  
  const lastActivityRef = useRef<number>(0);
  const checkIntervalRef = useRef<number | undefined>(undefined);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isOpenRef.current) {
      setIsOpen(false);
      isOpenRef.current = false;
      setTimeLeft(COUNTDOWN_MS);
      // Immediately send a heartbeat so the backend knows we continued
      apiClient.post('/auth/heartbeat', {}, { timeoutMs: 1500 }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    resetTimer();

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    let throttleTimer: number | null = null;
    let lastHeartbeatSent = Date.now();



    const handleActivity = () => {
      if (throttleTimer) return;
      if (isOpenRef.current) return;
      
      resetTimer();
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
      }, 1000);
    };

    events.forEach(event => document.addEventListener(event, handleActivity));

    checkIntervalRef.current = window.setInterval(() => {
      const now = Date.now();


      const idleTime = now - lastActivityRef.current;

      // Send a heartbeat every 60 seconds IF the user has been active since the last heartbeat
      if (now - lastHeartbeatSent >= 60000 && idleTime < 60000) {
        apiClient.post('/auth/heartbeat', {}, { timeoutMs: 1500 }).catch(() => {});
        lastHeartbeatSent = now;
      }

      if (idleTime >= IDLE_TIMEOUT_MS) {
        if (!isOpenRef.current) {
          setIsOpen(true);
          isOpenRef.current = true;
        }
        
        const remaining = COUNTDOWN_MS - (idleTime - IDLE_TIMEOUT_MS);
        
        if (remaining <= 0) {
          clearInterval(checkIntervalRef.current);
          setIsOpen(false);
          isOpenRef.current = false;
          logout();
        } else {
          setTimeLeft(remaining);
        }
      }
    }, 1000);

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [user, logout, resetTimer]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleContinue = () => {
    resetTimer();
  };

  const handleLogout = () => {
    setIsOpen(false);
    isOpenRef.current = false;
    logout();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[425px] [&>button]:hidden outline-none">
        <DialogHeader className="flex flex-col items-center space-y-4 pt-4">
          <div className="h-16 w-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <DialogTitle className="text-xl text-center">Session Timeout Warning</DialogTitle>
          <DialogDescription className="text-center">
            You have been inactive for a while. For your security, your session will automatically expire in:
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 flex justify-center">
          <div className="flex items-center space-x-2 text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">
            <Timer className="h-8 w-8" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        <DialogFooter className="flex gap-3 sm:justify-center">
          <Button variant="outline" onClick={handleLogout} className="flex-1 rounded-xl h-11 font-semibold">
            Log out now
          </Button>
          <Button 
            onClick={handleContinue} 
            className="flex-1 rounded-xl h-11 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all font-semibold"
          >
            Continue Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
