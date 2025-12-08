'use client';

import React, { useState } from 'react';

interface Props {
  customerId?: string
  api?: string
  theme?: 'light' | 'dark'
}

export default function ChatWidget({ customerId, api, theme }: Props) {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant'; content: string}[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg = {role: 'user' as const, content: input}
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    // Mock response since API not yet implemented
    setTimeout(() => {
      setMessages(prev => [...prev, {role: 'assistant' as const, content: `Mock response to: "${userMsg.content}". Customer ID: ${customerId || 'none'}. Using API: ${api || 'none'}. Theme: ${theme || 'light'}.` }])
      setLoading(false)
    }, 1500)
  }

  return (
    <div className={`w-full h-full flex flex-col border border-gray-200 rounded-lg p-4 bg-white ${theme === 'dark' ? 'dark:bg-gray-800 text-white' : 'dark:text-black'}`}>
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-2">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-lg shadow ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-black dark:text-white'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-xs px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-black dark:text-white">
              Assistant is typing...
            </div>
          </div>
        )}
      </div>
      <div className="flex space-x-2">
        <input 
          type="text" 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
          placeholder="Type your message..."
          disabled={loading}
        />
        <button 
          onClick={sendMessage} 
          disabled={loading || !input.trim()} 
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  )
}
