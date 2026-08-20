import { useEffect, useRef, useState } from "react";
import { Send, Bot, Sparkles, Square, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, MessageAvatar, MessageContent, MessageGroup } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { motion } from "framer-motion";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton
} from "@/components/ui/message-scroller";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

import { useAuth } from "@/lib/AuthContext";
import { useStreamingChat } from "@/hooks/useStreamingChat";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  };

const SUGGESTIONS = [
  "Summarize pending approvals",
  "Check connected systems health",
  "Analyze spend and budget impact",
  "Review recent security audits"
];

export default function FloatingChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);

  const [wakeToast, setWakeToast] = useState<string | null>(null);
  const [micPermissionState, setMicPermissionState] = useState<"granted" | "denied" | "prompt" | "unsupported">("prompt");

  const recognitionRef = useRef<any>(null);
  const currentModeRef = useRef<"idle" | "wake" | "dictating">("wake");
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const restartTimerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const dictationBaseRef = useRef("");
  const autoSendTimerRef = useRef<any>(null);
  const latestSpokenRef = useRef("");

  const { messages, setMessages, isStreaming, sendMessage, stopStreaming } = useStreamingChat();
  const [input, setInput] = useState("");

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  };

  const playWakeSound = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Could not play wake sound", e);
    }
  };

  const requestMicPermission = async () => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermissionState("granted");
        return true;
      } catch (err) {
        console.warn("Microphone access denied:", err);
        setMicPermissionState("denied");
        return false;
      }
    }
    return true;
  };

  // Process Wake Word or Command
  const handleWakeWordDetection = (transcript: string) => {
    console.log("🎙️ Wake word detected in transcript:", transcript);
    clearAutoSendTimer();
    playWakeSound();
    setIsOpen(true);
    setHasUnread(false);
    setWakeToast("🎙️ 'Hey Zena' detected!");
    setTimeout(() => setWakeToast(null), 3500);

    const WAKE_TRAILING_REGEX = /\b(?:hey|hay|hi|hello|ok|okay|yo|he)?\s*(?:zena|xena|gena|jena|zeena|zenna|zyna|sena|dina|zenabot|xenabot)[,\s:]*(.*)/i;
    const match = transcript.match(WAKE_TRAILING_REGEX);
    const trailingCommand = match && match[1] ? match[1].trim() : "";

    if (trailingCommand.length > 2) {
      setInput(trailingCommand);
      sendMessage(trailingCommand);
    } else {
      // Transition cleanly to dictation mode
      dictationBaseRef.current = "";
      latestSpokenRef.current = "";
      transitionToMode("dictating");
    }
  };

  // Master mode switcher for unified recognition engine
  const transitionToMode = (targetMode: "idle" | "wake" | "dictating") => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (targetMode !== "dictating") {
      clearAutoSendTimer();
    }

    currentModeRef.current = targetMode;
    setIsListening(targetMode === "dictating");

    if (targetMode === "idle" || (!wakeWordEnabled && targetMode === "wake")) {
      if (recognitionRef.current && !isStoppingRef.current) {
        try {
          isStoppingRef.current = true;
          recognitionRef.current.stop();
        } catch {}
      }
      return;
    }

    if (recognitionRef.current) {
      try {
        isStoppingRef.current = true;
        recognitionRef.current.stop();
      } catch {}
    }

    // Schedule start after previous instance completes stop
    restartTimerRef.current = setTimeout(() => {
      startEngineForCurrentMode();
    }, 150);
  };

  const startEngineForCurrentMode = () => {
    if (!recognitionRef.current) return;
    if (currentModeRef.current === "idle") return;
    if (currentModeRef.current === "wake" && !wakeWordEnabled) return;
    if (isStartingRef.current) return;

    try {
      isStartingRef.current = true;
      recognitionRef.current.start();
    } catch (err: any) {
      isStartingRef.current = false;
      if (err?.name === "InvalidStateError") {
        // Recognition already running, safe to continue
      }
    }
  };

  const scheduleRestart = (delayMs = 600) => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }
    restartTimerRef.current = setTimeout(() => {
      startEngineForCurrentMode();
    }, delayMs);
  };

  const toggleListening = async () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (currentModeRef.current === "dictating") {
      clearAutoSendTimer();
      transitionToMode(wakeWordEnabled ? "wake" : "idle");
    } else {
      dictationBaseRef.current = input;
      latestSpokenRef.current = input;
      const granted = await requestMicPermission();
      if (granted) {
        transitionToMode("dictating");
      }
    }
  };

  // Initialize Unified Speech Recognition Engine
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check system permission status if supported
    if (navigator.permissions && (navigator.permissions as any).query) {
      (navigator.permissions as any).query({ name: "microphone" }).then((status: any) => {
        setMicPermissionState(status.state);
        status.onchange = () => {
          setMicPermissionState(status.state);
          if (status.state === "granted" && wakeWordEnabled) {
            transitionToMode("wake");
          }
        };
      }).catch(() => {});
    }

    const SpeechRecognition =
      (window as WindowWithWebkitAudio).SpeechRecognition ||
      (window as WindowWithWebkitAudio).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicPermissionState("unsupported");
      return;
    }

    let isMounted = true;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    const WAKE_PHRASE_REGEX = /\b(hey\s+zena|hey\s+xena|hey\s+gena|hey\s+jena|hey\s+zeena|hey\s+zenna|hey\s+zyna|hey\s+sena|hey\s+dina|hay\s+zena|he\s+zena|hi\s+zena|hello\s+zena|ok\s+zena|okay\s+zena|yo\s+zena|zena\s*bot|xena\s*bot|\bzena\b|\bxena\b|\bgena\b|\bjena\b|\bzeena\b|\bzenna\b)\b/i;

    recognition.onstart = () => {
      isStartingRef.current = false;
      isStoppingRef.current = false;
      setMicPermissionState("granted");
      if (currentModeRef.current === "dictating") {
        setIsListening(true);
      }
    };

    recognition.onresult = (event: any) => {
      if (currentModeRef.current === "wake") {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += " " + event.results[i][0].transcript;
        }
        let currentSegment = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentSegment += " " + event.results[i][0].transcript;
        }

        const textToCheck = (currentSegment || fullTranscript).trim();
        if (!textToCheck) return;

        if (WAKE_PHRASE_REGEX.test(textToCheck.toLowerCase()) || WAKE_PHRASE_REGEX.test(fullTranscript.toLowerCase())) {
          handleWakeWordDetection(textToCheck || fullTranscript);
        }
      } else if (currentModeRef.current === "dictating") {
        let interimText = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalText += item[0].transcript + " ";
          } else {
            interimText += item[0].transcript;
          }
        }

        let currentActiveText = "";
        if (finalText) {
          dictationBaseRef.current = (dictationBaseRef.current ? `${dictationBaseRef.current.trim()} ${finalText.trim()}` : finalText.trim());
          currentActiveText = dictationBaseRef.current;
          setInput(dictationBaseRef.current);
        } else if (interimText) {
          const base = dictationBaseRef.current ? `${dictationBaseRef.current.trim()} ` : "";
          currentActiveText = base + interimText.trim();
          setInput(currentActiveText);
        }

        if (currentActiveText) {
          latestSpokenRef.current = currentActiveText;

          // "Hey Google" auto-send logic: automatically send message after 1.3 seconds of silence
          clearAutoSendTimer();
          autoSendTimerRef.current = setTimeout(() => {
            const queryToSend = latestSpokenRef.current.trim();
            if (queryToSend && queryToSend.length > 1 && !isStreaming) {
              console.log("🚀 Auto-sending query (Hey Google style):", queryToSend);
              transitionToMode(wakeWordEnabled ? "wake" : "idle");
              sendMessage(queryToSend);
              setInput("");
              dictationBaseRef.current = "";
              latestSpokenRef.current = "";
            }
          }, 1300);
        }
      }
    };

    recognition.onerror = (event: any) => {
      isStartingRef.current = false;
      isStoppingRef.current = false;

      if (event.error === "not-allowed") {
        setMicPermissionState("denied");
        return;
      }

      if (event.error === "no-speech" || event.error === "aborted") {
        // Normal quiet intervals, schedule restart
        if (isMounted && currentModeRef.current !== "idle") {
          scheduleRestart(400);
        }
        return;
      }

      console.warn("Speech recognition notice:", event.error);
      if (isMounted && currentModeRef.current !== "idle") {
        scheduleRestart(1000);
      }
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      isStoppingRef.current = false;

      // If speech finished naturally and there's a spoken message pending, send it
      if (currentModeRef.current === "dictating") {
        const queryToSend = latestSpokenRef.current.trim();
        if (queryToSend && queryToSend.length > 1 && !isStreaming) {
          clearAutoSendTimer();
          transitionToMode(wakeWordEnabled ? "wake" : "idle");
          sendMessage(queryToSend);
          setInput("");
          dictationBaseRef.current = "";
          latestSpokenRef.current = "";
        }
      }

      if (isMounted && currentModeRef.current !== "idle") {
        scheduleRestart(500);
      }
    };

    recognitionRef.current = recognition;

    // Expose programmatic test API on window for automated tests & subagents
    (window as any).__testHeyZena = (phrase = "Hey Zena summarize approvals") => {
      handleWakeWordDetection(phrase);
    };

    const handleCustomTestWake = (e: any) => {
      const phrase = e?.detail?.transcript || "Hey Zena summarize pending approvals";
      handleWakeWordDetection(phrase);
    };
    window.addEventListener("test-hey-zena", handleCustomTestWake);

    if (wakeWordEnabled) {
      startEngineForCurrentMode();
    }

    return () => {
      isMounted = false;
      window.removeEventListener("test-hey-zena", handleCustomTestWake);
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        recognition.stop();
      } catch {}
    };
  }, [wakeWordEnabled, sendMessage]);

  const [panelWidth, setPanelWidth] = useState(typeof window !== "undefined" ? window.innerWidth / 2 : 500);
  const isResizing = useRef(false);

  useEffect(() => {
    const stopResizing = () => {
      isResizing.current = false;
    };

    const resize = (e: MouseEvent) => {
      if (isResizing.current) {
        const newWidth = window.innerWidth - e.clientX;
        setPanelWidth(Math.max(300, Math.min(newWidth, window.innerWidth - 50)));
      }
    };

    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, []);

  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();
  };

  const endRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: "Hello, I’m ZenaBot 🤖. How can I assist you today?",
        },
      ]);
    }
  }, [messages.length, setMessages]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const playNotificationSound = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as WindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.error("Could not play sound", e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [messages, isStreaming, isOpen]);

  useEffect(() => {
    if (!isOpenRef.current && !isStreaming && messages.length > 1) {
      setHasUnread(true);
      playNotificationSound();
    }
  }, [isStreaming]);

  useEffect(() => {
    const handleAskAi = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      const query = customEvent.detail.query;
      if (!query) return;

      setIsOpen(true);
      setHasUnread(false);

      handleSend(query);
    };

    window.addEventListener("ask-ai", handleAskAi);
    return () => window.removeEventListener("ask-ai", handleAskAi);
  }, [messages, isStreaming]);

  async function handleSend(text: string) {
    if (isStreaming) return;
    clearAutoSendTimer();
    setInput("");
    dictationBaseRef.current = "";
    latestSpokenRef.current = "";
    sendMessage(text);
  }

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (open) setHasUnread(false);
      }}>
        <SheetContent side="right" style={{ width: panelWidth }} className="!max-w-none flex flex-col p-0 border-l border-border h-screen bg-background/95 backdrop-blur-xl">
          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/50 transition-colors z-50 group"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-border rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <SheetHeader className="flex flex-row items-center justify-between border-b border-border/30 pb-3 px-5 pt-5 shrink-0 bg-gradient-to-b from-background/50 to-transparent space-y-0">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400 filter drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
              ZenaBot
            </SheetTitle>
            <SheetDescription className="sr-only">
              ZenaBot AI Executive Assistant Chat Drawer
            </SheetDescription>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!wakeWordEnabled) {
                    await requestMicPermission();
                    setWakeWordEnabled(true);
                    transitionToMode("wake");
                  } else {
                    setWakeWordEnabled(false);
                    transitionToMode("idle");
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  wakeWordEnabled
                    ? micPermissionState === "denied"
                      ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 shadow-sm"
                    : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800"
                }`}
                title={
                  micPermissionState === "denied"
                    ? "Microphone access blocked. Click to retry permission."
                    : "Say 'Hey Zena' anytime to open assistant"
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    wakeWordEnabled
                      ? micPermissionState === "denied"
                        ? "bg-amber-500"
                        : "bg-emerald-500 animate-ping"
                      : "bg-slate-400"
                  }`}
                />
                <Mic className="h-3 w-3" />
                <span>
                  {micPermissionState === "denied"
                    ? "Mic Blocked"
                    : `"Hey Zena" ${wakeWordEnabled ? "Active" : "Off"}`}
                </span>
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden relative flex flex-col">
            <MessageScrollerProvider>
              <MessageScroller className="h-full">
                <MessageScrollerViewport className="custom-scrollbar">
                  <MessageScrollerContent className="p-4">
                    <MessageGroup>
                      {messages.map((message, index) => (
                        <MotionMessageScrollerItem
                          key={index}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          scrollAnchor={index === messages.length - 1 && !isStreaming}
                        >
                          <Message align={message.role === "user" ? "end" : "start"}>
                            <MessageAvatar className={message.role === "user" ? "h-8 w-8 min-w-8 shrink-0 overflow-hidden rounded-full border border-blue-100 dark:border-blue-900 shadow-sm ring-2 ring-blue-50 dark:ring-blue-950" : "h-8 w-8 min-w-8 shrink-0 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 dark:from-blue-900 dark:to-indigo-900 dark:text-blue-400 overflow-hidden rounded-full shadow-sm"}>
                              {message.role === "user" ? (
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || user?.email || "User")}&background=eff6ff&color=2563eb&rounded=true&bold=true`} alt="User avatar" className="h-full w-full object-cover" />
                              ) : (
                                <Bot size={18} />
                              )}
                            </MessageAvatar>
                            <MessageContent>
                              {message.content && (
                                <Bubble
                                  variant={message.role === "user" ? "default" : "muted"}
                                  className={message.role === "user" ? "[&>[data-slot=bubble-content]]:bg-gradient-to-br [&>[data-slot=bubble-content]]:from-blue-600 [&>[data-slot=bubble-content]]:to-indigo-600 [&>[data-slot=bubble-content]]:text-white [&>[data-slot=bubble-content]]:shadow-md [&>[data-slot=bubble-content]]:border-none" : "[&>[data-slot=bubble-content]]:bg-muted/50 [&>[data-slot=bubble-content]]:shadow-sm [&>[data-slot=bubble-content]]:border [&>[data-slot=bubble-content]]:border-border/50"}
                                >
                                  <BubbleContent>
                                    {message.content}
                                    {isStreaming && index === messages.length - 1 && message.role === "assistant" && (
                                      <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary animate-pulse" />
                                    )}
                                  </BubbleContent>
                                </Bubble>
                              )}
                              {message.toolStatus && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 ml-1 animate-in fade-in slide-in-from-top-1">
                                  <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                  {message.toolStatus}
                                </div>
                              )}
                            </MessageContent>
                          </Message>
                        </MotionMessageScrollerItem>
                      ))}
                      <div ref={endRef} />
                    </MessageGroup>
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>

            {messages.length === 1 && (
              <div className="absolute bottom-4 left-0 right-0 px-4 flex flex-wrap gap-2 pointer-events-none justify-start">
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => handleSend(item)}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-border/50 bg-background/80 backdrop-blur-sm shadow-sm rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/50 text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 pointer-events-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-col gap-2 p-4 shrink-0 bg-gradient-to-t from-background via-background to-transparent border-t-0 relative z-20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (input.trim()) handleSend(input);
              }}
              className="w-full flex flex-col rounded-2xl bg-muted/40 backdrop-blur-md shadow-inner border border-border/50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/50 focus-within:bg-background/80 transition-all duration-300"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="w-full resize-none bg-transparent px-4 py-3 outline-none text-sm min-h-[60px] custom-scrollbar"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim()) handleSend(input);
                  }
                }}
              />
              <div className="flex items-center justify-between p-2 pt-0">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleListening}
                    className={`h-8 px-3 rounded-full text-xs font-medium gap-1.5 transition-all ${
                      isListening
                        ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {isListening ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                        <MicOff className="w-3.5 h-3.5 text-rose-600" />
                        <span>Listening (auto-sends on pause)...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>Voice Mic</span>
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  {isStreaming ? (
                    <Button
                      type="button"
                      onClick={stopStreaming}
                      className="h-9 w-9 rounded-full p-0 shrink-0 bg-gradient-to-tr from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md mr-1 transition-all hover:scale-105 active:scale-95 animate-in zoom-in"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span className="sr-only">Stop</span>
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={!input.trim() || isStreaming}
                      className="h-9 w-9 rounded-full p-0 shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50 mr-1 transition-all hover:scale-105 active:scale-95 animate-in zoom-in"
                    >
                      <Send className="w-4 h-4" />
                      <span className="sr-only">Send</span>
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Wake Word Toast Notification */}
      {wakeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold border border-white/20 dark:border-slate-300 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>{wakeToast}</span>
        </div>
      )}

      {/* Floating Action Button (to trigger Sheet) */}
      <div data-onboarding="ai-assistant" className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2.5 ${isOpen ? "hidden" : ""}`}>
        {wakeWordEnabled && (
          <div
            onClick={async () => {
              setIsOpen(true);
              setHasUnread(false);
              const granted = await requestMicPermission();
              if (granted) {
                dictationBaseRef.current = "";
                transitionToMode("dictating");
              }
            }}
            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-lg border border-slate-200/80 dark:border-slate-800 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:scale-105 transition-all animate-in fade-in slide-in-from-right-3 group"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${micPermissionState === "denied" ? "bg-amber-400" : "bg-emerald-400"} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${micPermissionState === "denied" ? "bg-amber-500" : "bg-emerald-500"}`}></span>
            </span>
            <span>
              {micPermissionState === "denied" ? (
                <span className="text-amber-600 dark:text-amber-400">Click to Enable Mic</span>
              ) : (
                <>Say <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:underline">"Hey Zena"</span></>
              )}
            </span>
          </div>
        )}

        <button
          onClick={async () => {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (nextOpen) {
              setHasUnread(false);
              if (wakeWordEnabled) {
                const granted = await requestMicPermission();
                if (granted) {
                  dictationBaseRef.current = "";
                  transitionToMode("dictating");
                }
              }
            }
          }}
          className="h-14 w-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-[0_4px_20px_rgba(79,70,229,0.4)] hover:shadow-[0_8px_25px_rgba(79,70,229,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 relative group"
        >
          <Bot className="h-6 w-6 group-hover:animate-pulse" />
          {!isOpen && hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-background"></span>
            </span>
          )}
        </button>
      </div>
    </>
  );
}
