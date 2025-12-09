'use client';

import { useChat } from '@ai-sdk/react'
import { useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { Loader2, Send } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  ScrollArea,
  ScrollBar,
} from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ChatWidgetProps {
  customerId?: string
  api?: string
  theme?: 'light' | 'dark'
  onError?: (error: Error) => void
}

export default function ChatWidget({
  customerId,
  api = '/api/chat',
  theme,
  onError,
}: ChatWidgetProps) {
  const transport = new DefaultChatTransport({ api: api })

  const { messages, error, status, sendMessage } = useChat({
    transport,
    initialMessages: [
      {
        role: 'assistant' as const,
        content: 'Hello! I am Grok, powered by xAI. How can I help you today?',
      },
    ],
    onError: (err: unknown) => {
      console.error('Chat error:', err)
      onError?.(err as Error)
    },
  } as any)

  const [inputValue, setInputValue] = useState('')

  const inputIsLoading = status === 'streaming'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || inputIsLoading) return
    await sendMessage({ role: 'user' as const, content: inputValue } as any, customerId ? { headers: { 'customer-id': customerId } } : undefined)
    setInputValue('')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }



  return (
    <Card className={cn(
      'w-full max-w-md h-[600px] flex flex-col',
      theme === 'dark' && 'dark'
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary text-primary-foreground">G</AvatarFallback>
          </Avatar>
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-normal">Grok Chat</CardTitle>
            <CardDescription className="text-xs">AI Assistant</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-0 flex flex-1 flex-col p-0">
        <ScrollArea className="flex flex-1">
          <div className="p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={message.id ?? index}
                className={cn(
                  'flex gap-3',
                  (message as any).role === 'user'
                    ? 'justify-end flex-row-reverse'
                    : 'justify-start'
                )}
              >
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback
                    className={cn(
                      (message as any).role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    )}
                  >
                    {(message as any).role === 'user' ? 'U' : 'G'}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'flex flex-col gap-1 max-w-[70%] p-3 rounded-lg',
                    (message as any).role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground border'
                  )}
                >
                  <p className="text-sm leading-relaxed">{(message as any).content}</p>
                </div>
              </div>
            ))}
            {inputIsLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-muted">G</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 max-w-[70%] p-3 rounded-lg bg-muted text-foreground border">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Grok is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <ScrollBar />
        </ScrollArea>
        {error && (
          <div className="p-4 border-t bg-destructive/10 text-destructive text-sm">
            Error: {error.message}. Please try again.
          </div>
        )}
        <form onSubmit={handleSubmit} className="border-t p-4 gap-2 flex">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Ask Grok anything..."
            className="flex-1"
            disabled={inputIsLoading}
          />
          <Button type="submit" size="icon" disabled={!inputValue.trim() || inputIsLoading}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
