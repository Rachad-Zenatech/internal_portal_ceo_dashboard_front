import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Bot, Sparkles, Square, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, MessageAvatar, MessageGroup } from "@/components/ui/message";
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
import { toast } from "sonner";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
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
  const [, setHasUnread] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const { messages, setMessages, isStreaming, sendMessage, stopStreaming } = useStreamingChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: "Hello, I'm ZenaBot. How can I assist you today?",
        },
      ]);
    }
  }, [messages.length, setMessages]);

  // Listen for Open Chat events triggered from TopBar or Global Search
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>;
      setIsOpen(true);
      setHasUnread(false);
      if (customEvent.detail?.query) {
        setInput(customEvent.detail.query);
        sendMessage(customEvent.detail.query);
      }
    };

    const handleAskAi = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      const query = customEvent?.detail?.query;
      if (!query) return;
      setIsOpen(true);
      setHasUnread(false);
      setInput(query);
      sendMessage(query);
    };

    window.addEventListener("open-ai-chat", handleOpenChat);
    window.addEventListener("ask-ai-search", handleAskAi);

    return () => {
      window.removeEventListener("open-ai-chat", handleOpenChat);
      window.removeEventListener("ask-ai-search", handleAskAi);
    };
  }, [sendMessage]);

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, isStreaming, isOpen]);

  // Clean on-demand speech recognition (activated only on user click)
  const toggleListening = useCallback(() => {
    const SpeechRecognition =
      (window as WindowWithWebkitAudio).SpeechRecognition ||
      (window as WindowWithWebkitAudio).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInput(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e?.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  }, [isListening]);

  // Resizable panel logic
  const [panelWidth, setPanelWidth] = useState(typeof window !== "undefined" ? Math.min(500, window.innerWidth / 2) : 500);
  const isResizing = useRef(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      setPanelWidth(Math.max(320, Math.min(newWidth, window.innerWidth - 50)));
    };

    const onMouseUp = () => {
      isResizing.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={() => {
            setIsOpen(true);
            setHasUnread(false);
          }}
          className="h-12 px-4 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 gap-2 cursor-pointer flex items-center"
        >
          <Bot className="w-5 h-5 text-white" />
          <span className="text-xs font-semibold">Ask AI</span>
        </Button>
      </div>

      {/* AI Assistant Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          style={{ width: `${panelWidth}px` }}
          className="p-0 sm:max-w-none flex flex-col h-full bg-slate-50 dark:bg-zinc-950 border-l border-slate-200 dark:border-zinc-800"
        >
          {/* Resize Handle */}
          <div
            onMouseDown={startResizing}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-indigo-500/40 transition-colors z-50"
            title="Drag to resize chat panel"
          />

          <SheetHeader className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <SheetTitle className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>ZenaBot Executive AI</span>
                  </SheetTitle>
                  <SheetDescription className="text-[11px] text-muted-foreground">
                    Connected to unified telemetry & corporate datasets.
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <MessageScrollerProvider>
              <MessageScroller>
                <MessageScrollerViewport className="space-y-4">
                  <MessageScrollerContent>
                    {messages.map((msg, index) => (
                      <MotionMessageScrollerItem
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Message
                          className={
                            msg.role === "user"
                              ? "flex justify-end"
                              : "flex justify-start"
                          }
                        >
                          <MessageGroup
                            className={
                              msg.role === "user"
                                ? "items-end"
                                : "items-start"
                            }
                          >
                            <div className="flex items-start gap-2 max-w-[85%]">
                              {msg.role === "assistant" && (
                                <MessageAvatar className="h-7 w-7 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 shrink-0">
                                  <Bot className="h-4 w-4" />
                                </MessageAvatar>
                              )}
                              <Bubble
                                variant={msg.role === "user" ? "sent" : "received"}
                                className={`rounded-2xl text-xs leading-relaxed ${
                                  msg.role === "user"
                                    ? "bg-indigo-600 text-white p-3 shadow-2xs"
                                    : "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 p-3.5 border border-slate-200/80 dark:border-zinc-800 shadow-2xs"
                                }`}
                              >
                                <BubbleContent>
                                  <div className="whitespace-pre-wrap">
                                    {msg.content || (
                                      <span className="flex items-center gap-1.5 text-muted-foreground italic">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Thinking...
                                      </span>
                                    )}
                                  </div>
                                </BubbleContent>
                              </Bubble>
                            </div>
                          </MessageGroup>
                        </Message>
                      </MotionMessageScrollerItem>
                    ))}
                    <div ref={endRef} />
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          </div>

          {/* Suggestions Pill Tray */}
          {messages.length <= 2 && !isStreaming && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/50 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInput(sug);
                    sendMessage(sug);
                  }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 transition-all cursor-pointer shadow-2xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={toggleListening}
                className={`h-9 w-9 rounded-xl shrink-0 ${
                  isListening
                    ? "bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                }`}
                title={isListening ? "Listening... (Click to stop)" : "Dictate via voice"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <input
                type="text"
                placeholder="Ask about approvals, finances, operations..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 h-9 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-900 dark:text-zinc-100 border-none outline-none placeholder:text-muted-foreground"
              />

              {isStreaming ? (
                <Button
                  size="icon"
                  type="button"
                  onClick={stopStreaming}
                  className="h-9 w-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shrink-0 cursor-pointer"
                  title="Stop generating"
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-9 w-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer disabled:opacity-40"
                  title="Send query"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
