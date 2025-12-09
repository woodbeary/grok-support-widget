import React from 'react'
import '../widget-globals.css'
import ChatWidget from '../components/ChatWidget' // Adjust path as needed

interface WidgetProps {
  customerId?: string
  api?: string
  theme?: 'light' | 'dark'
}

const WidgetRoot: React.FC<WidgetProps> = ({ customerId, api, theme }) => {
  return <ChatWidget customerId={customerId} api={api} theme={theme} />
}

export default WidgetRoot
