import { useState, useRef, useCallback } from "react";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  file?: { name: string; type: string };
  toolStatus?: string;
};

export type ChatStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_status"; content: string }
  | { type: "tool_result"; toolName?: string; summary?: string }
  | { type: "permission_error"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function useStreamingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, fileData?: string, mimeType?: string, fileName?: string, fileExt?: string) => {
      const question = text.trim();
      if (!question && !fileData) return;

      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);

      const nextMessages: ChatMessage[] = [
        ...messages,
        {
          role: "user",
          content: question,
          file: fileData ? { name: fileName || "Attachment", type: fileExt || "FILE" } : undefined,
        },
      ];

      setMessages([...nextMessages, { role: "assistant", content: "", toolStatus: undefined }]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: question,
            history: messages,
            file_data: fileData,
            mime_type: mimeType,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error("Failed to connect to AI service.");
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || ""; // keep the last incomplete part in the buffer

            for (const part of parts) {
              if (part.startsWith("data: ")) {
                const jsonStr = part.substring(6);
                if (!jsonStr.trim()) continue;

                try {
                  const event: ChatStreamEvent = JSON.parse(jsonStr);

                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const last = { ...newMessages[newMessages.length - 1] };

                    if (event.type === "text") {
                      last.content += event.content;
                      last.toolStatus = undefined; // clear tool status when typing
                    } else if (event.type === "tool_status") {
                      last.toolStatus = event.content;
                    } else if (event.type === "error" || event.type === "permission_error") {
                      setError(event.message);
                      last.content += `\n\n**Error:** ${event.message}`;
                    } else if (event.type === "done") {
                      last.toolStatus = undefined;
                    }

                    newMessages[newMessages.length - 1] = last;
                    return newMessages;
                  });
                } catch (e) {
                  console.error("Failed to parse SSE JSON:", e, jsonStr);
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error(err);
          setError(err.message || "An error occurred");
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Something went wrong while contacting the AI backend." },
          ]);
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [messages, isStreaming]
  );

  return {
    messages,
    setMessages,
    isStreaming,
    error,
    sendMessage,
    stopStreaming,
  };
}
