import { useEffect, useRef, useState } from "react";
import { Send, Bot, Sparkles, Square, Loader2 } from "lucide-react";
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
} from "@/components/ui/sheet";

import { useAuth } from "@/lib/AuthContext";
import { useStreamingChat } from "@/hooks/useStreamingChat";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const SUGGESTIONS = [];

export default function FloatingChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const { messages, setMessages, isStreaming, sendMessage, stopStreaming } = useStreamingChat();

  const [input, setInput] = useState("");

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
    setInput("");
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

          <SheetHeader className="gap-1 border-b border-border/30 pb-3 px-5 pt-5 shrink-0 bg-gradient-to-b from-background/50 to-transparent">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400 filter drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
              ZenaBot
            </SheetTitle>
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
              <div className="flex items-center justify-end p-2 pt-0">
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
            </form>
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating Action Button (to trigger Sheet) */}
      <div data-onboarding="ai-assistant" className={`fixed bottom-6 right-6 z-[100] flex flex-col items-end ${isOpen ? "hidden" : ""}`}>
        <button
          onClick={() => {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (nextOpen) {
              setHasUnread(false);
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
