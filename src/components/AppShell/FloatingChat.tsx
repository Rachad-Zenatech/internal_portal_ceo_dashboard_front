import { ChatMessageRenderer } from "./ChatMessageRenderer";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Bot,
  Sparkles,
  Square,
  Loader2,
  Copy,
  Check,
  HelpCircle,
  RotateCcw,
  Building2,
  Activity,
  Landmark,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message, MessageAvatar, MessageContent, MessageGroup } from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useStreamingChat } from "@/hooks/useStreamingChat";

const MotionMessageScrollerItem = motion.create(MessageScrollerItem);

type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const SUGGESTIONS = [
  {
    icon: Building2,
    label: "Pending Approvals",
    query: "What purchase requests are currently pending executive approval?",
  },
  {
    icon: Activity,
    label: "System Telemetry",
    query: "Check connected system telemetry status across Admin, M&A, and Finance services.",
  },
  {
    icon: Landmark,
    label: "Financial & GL Metrics",
    query: "Summarize treasury liquid assets, monthly net income, and bank balances.",
  },
  {
    icon: ShieldCheck,
    label: "Governance & PBAC",
    query: "Explain executive sign-off policies and approver delegation thresholds.",
  },
];

export default function FloatingChat() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const { messages, setMessages, isStreaming, sendMessage, stopStreaming } = useStreamingChat();
  const [input, setInput] = useState("");

  const [panelWidth, setPanelWidth] = useState(typeof window !== "undefined" ? Math.min(520, window.innerWidth / 2) : 500);
  const isResizing = useRef(false);

  useEffect(() => {
    const stopResizing = () => {
      isResizing.current = false;
    };

    const resize = (e: MouseEvent) => {
      if (isResizing.current) {
        const newWidth = window.innerWidth - e.clientX;
        setPanelWidth(Math.max(320, Math.min(newWidth, window.innerWidth - 50)));
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
          content: "Hello! I’m ZenaBot 🤖, your Executive AI Assistant. How can I assist you with executive governance, financial metrics, purchase approvals, or system telemetry today?",
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

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
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
      const timer = setTimeout(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, isStreaming, isOpen]);

  useEffect(() => {
    if (!isOpenRef.current && !isStreaming && messages.length > 1) {
      playNotificationSound();
    }
  }, [isStreaming, messages.length]);

  const handleSend = useCallback(
    async (text: string) => {
      if (isStreaming) return;
      setInput("");
      sendMessage(text);
    },
    [isStreaming, sendMessage]
  );

  // Listen for Open Chat events triggered from TopBar or Global Search
  useEffect(() => {
    const handleOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ query?: string }>;
      setIsOpen(true);
      if (customEvent.detail?.query) {
        void handleSend(customEvent.detail.query);
      }
    };

    const handleAskAi = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      const query = customEvent.detail?.query;
      if (!query) return;

      setIsOpen(true);
      void handleSend(query);
    };

    window.addEventListener("open-ai-chat", handleOpenChat);
    window.addEventListener("ask-ai", handleAskAi);
    window.addEventListener("ask-ai-search", handleAskAi);

    return () => {
      window.removeEventListener("open-ai-chat", handleOpenChat);
      window.removeEventListener("ask-ai", handleAskAi);
      window.removeEventListener("ask-ai-search", handleAskAi);
    };
  }, [handleSend]);

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      toast.success("Message copied to clipboard");
      setTimeout(() => {
        setCopiedIndex((prev) => (prev === index ? null : prev));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy", err);
      toast.error("Failed to copy message");
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Hello! I’m ZenaBot 🤖, your Executive AI Assistant. How can I assist you with executive governance, financial metrics, purchase approvals, or system telemetry today?",
      },
    ]);
    toast.success("Chat history cleared");
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <SheetContent
        side="right"
        style={{ width: panelWidth }}
        className="!max-w-none flex flex-col p-0 border-l border-border h-screen bg-background/95 backdrop-blur-xl"
      >
        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/50 transition-colors z-50 group"
          title="Drag to resize chat panel"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-border rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Header */}
        <SheetHeader className="gap-1 border-b border-border/40 pb-3 pl-5 pr-12 pt-4 shrink-0 bg-background/50 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400 filter drop-shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
              ZenaBot
            </SheetTitle>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGuide((prev) => !prev)}
                className={`h-7 px-2 text-xs font-normal gap-1 transition-colors ${
                  showGuide
                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Show how to use ZenaBot"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Hints & Guide</span>
                {showGuide ? (
                  <ChevronUp className="h-3 w-3 opacity-60" />
                ) : (
                  <ChevronDown className="h-3 w-3 opacity-60" />
                )}
              </Button>
              {messages.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleResetChat}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Clear conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="sr-only">Clear chat</span>
                </Button>
              )}
            </div>
          </div>

          {/* Collapsible Hints / Guide Box */}
          <AnimatePresence>
            {showGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 text-xs space-y-2 text-foreground">
                  <div className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> How to use ZenaBot
                  </div>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-300 list-disc list-inside">
                    <li>
                      <strong className="font-medium text-slate-800 dark:text-slate-100">Executive Approvals:</strong> Ask about pending purchase requests, tiers, and approval status.
                    </li>
                    <li>
                      <strong className="font-medium text-slate-800 dark:text-slate-100">Finance & GL:</strong> Inquire about treasury liquid assets, net income, and general ledger accounts.
                    </li>
                    <li>
                      <strong className="font-medium text-slate-800 dark:text-slate-100">Copy Answers:</strong> Click the copy icon below any response to copy text.
                    </li>
                    <li>
                      <strong className="font-medium text-slate-800 dark:text-slate-100">Shortcuts:</strong> Press <kbd className="px-1 py-0.5 rounded bg-background border border-border text-[10px] font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-background border border-border text-[10px] font-mono">Shift + Enter</kbd> for a new line.
                    </li>
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SheetHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <MessageScrollerProvider>
            <MessageScroller className="h-full">
              <MessageScrollerViewport className="custom-scrollbar">
                <MessageScrollerContent className="p-4 space-y-4">
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
                          <MessageAvatar
                            className={
                              message.role === "user"
                                ? "h-8 w-8 min-w-8 shrink-0 overflow-hidden rounded-full border border-blue-100 dark:border-blue-900 shadow-xs ring-2 ring-blue-50 dark:ring-blue-950"
                                : "h-8 w-8 min-w-8 shrink-0 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600 dark:from-blue-900 dark:to-indigo-900 dark:text-blue-400 overflow-hidden rounded-full shadow-xs"
                            }
                          >
                            {message.role === "user" ? (
                              <img
                                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  user?.full_name || user?.email || "User"
                                )}&background=eff6ff&color=2563eb&rounded=true&bold=true`}
                                alt="User avatar"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Bot size={18} />
                            )}
                          </MessageAvatar>
                          <MessageContent>
                            {message.content && (
                              <Bubble
                                variant={message.role === "user" ? "default" : "muted"}
                                className={
                                  message.role === "user"
                                    ? "[&>[data-slot=bubble-content]]:bg-gradient-to-br [&>[data-slot=bubble-content]]:from-blue-600 [&>[data-slot=bubble-content]]:to-indigo-600 [&>[data-slot=bubble-content]]:text-white [&>[data-slot=bubble-content]]:shadow-md [&>[data-slot=bubble-content]]:border-none"
                                    : "[&>[data-slot=bubble-content]]:bg-muted/50 [&>[data-slot=bubble-content]]:shadow-xs [&>[data-slot=bubble-content]]:border [&>[data-slot=bubble-content]]:border-border/50"
                                }
                              >
                                <BubbleContent>
                                  <ChatMessageRenderer
                                    content={message.content}
                                    role={message.role}
                                  />
                                  {isStreaming && index === messages.length - 1 && message.role === "assistant" && (
                                    <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-primary animate-pulse" />
                                  )}
                                </BubbleContent>
                              </Bubble>
                            )}

                            {/* Tool status loader */}
                            {message.toolStatus && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 ml-1 animate-in fade-in slide-in-from-top-1">
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                                {message.toolStatus}
                              </div>
                            )}

                            {/* Copy Action Button below message */}
                            {message.content && !(isStreaming && index === messages.length - 1 && message.role === "assistant") && (
                              <div
                                className={`flex items-center gap-1 mt-1 px-1 ${
                                  message.role === "user" ? "justify-end" : "justify-start"
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleCopy(message.content, index)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/80 active:bg-muted transition-colors cursor-pointer"
                                  title="Copy message"
                                >
                                  {copiedIndex === index ? (
                                    <>
                                      <Check className="h-3 w-3 text-green-500" />
                                      <span className="text-[11px] text-green-600 dark:text-green-400 font-medium">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3 opacity-70" />
                                      <span className="text-[11px]">Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </MessageContent>
                        </Message>
                      </MotionMessageScrollerItem>
                    ))}

                    {/* Welcome Starter Guide & Hints when starting */}
                    {messages.length === 1 && !isStreaming && (
                      <div className="pt-2 pb-4 space-y-3 animate-in fade-in-50 duration-300">
                        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-blue-50/40 via-muted/30 to-indigo-50/30 dark:from-blue-950/20 dark:via-muted/20 dark:to-indigo-950/20 p-4 space-y-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span>Quick Suggestions & Hints</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Click any prompt below to get started, or type your query into the box below.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {SUGGESTIONS.map((item, idx) => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => handleSend(item.query)}
                                  className="flex items-start gap-2.5 p-2.5 text-left rounded-lg border border-border/60 bg-background/80 hover:bg-blue-50/80 dark:hover:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-800 transition-all group shadow-2xs cursor-pointer"
                                >
                                  <div className="p-1.5 rounded-md bg-blue-100/60 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                                      {item.label}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                      {item.query}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={endRef} />
                  </MessageGroup>
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>

        {/* Input & Helper footer */}
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
              placeholder="Ask ZenaBot anything (e.g. pending approvals, telemetry status, treasury balances)..."
              className="w-full resize-none bg-transparent px-4 py-3 outline-none text-sm min-h-[60px] custom-scrollbar"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim()) handleSend(input);
                }
              }}
            />
            <div className="flex items-center justify-between px-3 pb-2 pt-0">
              <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1">
                <span>Press <kbd className="px-1 py-0.2 bg-muted rounded border border-border text-[10px]">Enter</kbd> to send, <kbd className="px-1 py-0.2 bg-muted rounded border border-border text-[10px]">Shift+Enter</kbd> for newline</span>
              </span>
              <div className="flex items-center ml-auto">
                {isStreaming ? (
                  <Button
                    type="button"
                    onClick={stopStreaming}
                    className="h-9 w-9 rounded-full p-0 shrink-0 bg-gradient-to-tr from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md mr-1 transition-all hover:scale-105 active:scale-95 animate-in zoom-in cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span className="sr-only">Stop</span>
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={!input.trim() || isStreaming}
                    className="h-9 w-9 rounded-full p-0 shrink-0 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md disabled:opacity-50 mr-1 transition-all hover:scale-105 active:scale-95 animate-in zoom-in cursor-pointer"
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
  );
}
