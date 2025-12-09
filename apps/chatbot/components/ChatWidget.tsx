'use client';

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { useState, useEffect, useRef } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import TicketCard from './TicketCard'

interface ChatWidgetProps {
  customerId?: string
  api?: string
  theme?: 'light' | 'dark'
  isEmbed?: boolean
  onError?: (error: Error) => void
}

/**
 * Chat Widget with xAI/Grok dark aesthetic.
 * Renders inline artifacts (like TicketCard) for tool results.
 */
export default function ChatWidget({
  customerId,
  api = '/api/chat',
  theme = 'dark',
  isEmbed = false,
  onError,
}: ChatWidgetProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api }),
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hey! How can I help you today?' }],
      }
    ] as UIMessage[],
    onFinish: (result) => console.log('[ChatWidget] onFinish:', result),
    onError: (err: Error) => {
      console.error('[ChatWidget] error:', err.message);
      onError?.(err);
    },
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    const text = inputValue.trim()
    setInputValue('')
    try {
      await sendMessage({ text })
    } catch (err) {
      console.error('[ChatWidget] Send failed:', err)
    }
    inputRef.current?.focus()
  }

  // Extract text content from message
  const getMessageText = (message: any): string => {
    if (message.content) return message.content
    if (message.parts) {
      return message.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('')
    }
    return ''
  }

  // Extract ticket tool result from message parts
  const getTicketFromParts = (parts: any[]): { title: string; description: string; ticketId?: string } | null => {
    if (!parts) return null
    const ticketPart = parts.find((p: any) =>
      p.type === 'tool-createTicket' &&
      (p.state === 'output-available' || p.state === 'result')
    )
    if (ticketPart?.input) {
      return {
        title: ticketPart.input.title || 'Support Ticket',
        description: ticketPart.input.description || '',
        ticketId: ticketPart.output?.match?.(/ID ([a-f0-9-]+)/)?.[1] || undefined
      }
    }
    return null
  }

  // Close widget (sends message to parent if embedded)
  const handleClose = () => {
    if (isEmbed && typeof window !== 'undefined') {
      window.parent.postMessage('close-widget', '*')
    }
  }

  return (
    <div className={cn(
      'flex flex-col overflow-hidden bg-[#000000] text-white',
      isEmbed
        ? 'w-full h-full rounded-none border-0'
        : 'w-full max-w-md h-[600px] rounded-2xl shadow-2xl border border-[#222]'
    )}>
      {/* Header - xAI style */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#222] bg-[#0a0a0a]">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border border-[#333]">
          <span className="text-white font-bold text-sm">G</span>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-sm text-white">Grok</h2>
          <p className="text-xs text-gray-500">
            {isLoading ? 'Typing...' : 'Online'}
          </p>
        </div>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isLoading ? "bg-yellow-500 animate-pulse" : "bg-green-500"
        )} />
        {isEmbed && (
          <button
            onClick={handleClose}
            className="ml-2 p-1.5 rounded-full hover:bg-[#222] transition-colors cursor-pointer"
            aria-label="Close chat"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#000]">
        {messages.map((message, index) => {
          const text = getMessageText(message)
          const isUser = message.role === 'user'
          const ticket = !isUser ? getTicketFromParts(message.parts as any[]) : null

          // Skip empty messages unless they have a ticket
          if (!text && !ticket) return null

          return (
            <div key={message.id ?? index} className="space-y-3">
              {/* Text message */}
              {text && (
                <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                  {/* Grok avatar - only for assistant */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center mr-2 flex-shrink-0 border border-[#333]">
                      <span className="text-xs font-medium text-gray-300">G</span>
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={cn(
                      'max-w-[80%] px-4 py-2.5 text-sm leading-relaxed',
                      isUser
                        ? 'bg-[#1a1a1a] text-white rounded-2xl rounded-br-sm'
                        : 'bg-[#111] text-gray-100 rounded-2xl rounded-bl-sm border border-[#222]'
                    )}
                  >
                    {text}
                  </div>
                </div>
              )}

              {/* Inline Ticket Card artifact */}
              {ticket && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center mr-2 flex-shrink-0 border border-[#333] opacity-0">
                    <span className="text-xs font-medium text-gray-300">G</span>
                  </div>
                  <TicketCard
                    title={ticket.title}
                    description={ticket.description}
                    ticketId={ticket.ticketId}
                    onStartNew={() => window.location.reload()}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Loading indicator */}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center mr-2 flex-shrink-0 border border-[#333]">
              <span className="text-xs font-medium text-gray-300">G</span>
            </div>
            <div className="bg-[#111] px-4 py-3 rounded-2xl rounded-bl-sm border border-[#222]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-500" data-testid="loader-icon" />
                <span className="text-sm text-gray-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 text-sm bg-red-900/30 border-t border-red-900/50 text-red-400">
          Error: {error.message}
        </div>
      )}

      {/* Input - xAI style */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-[#222] bg-[#0a0a0a]">
        <input
          ref={inputRef}
          autoFocus
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Message Grok..."
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 rounded-full text-sm bg-[#111] border border-[#333] text-white placeholder-gray-600 outline-none focus:border-gray-500 disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer',
            inputValue.trim() && !isLoading
              ? 'bg-white text-black hover:bg-gray-200'
              : 'bg-[#222] text-gray-600 cursor-not-allowed'
          )}
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  )
}
