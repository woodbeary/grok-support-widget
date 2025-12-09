import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatWidget from '../ChatWidget';

// Mock AI SDK modules
jest.mock('ai', () => ({
  DefaultChatTransport: jest.fn(() => ({})),
  UIMessage: {},
}));

// Mock useChat hook for unit test - updated for AI SDK v5 API
jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn(() => ({
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hey! How can I help you today?' }]
      },
    ],
    error: null,
    status: 'ready',
    sendMessage: jest.fn(),
    setMessages: jest.fn(),
  })),
}));

describe('ChatWidget', () => {
  // Mock scrollIntoView for JSDOM
  beforeAll(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders initial Grok message', () => {
    render(<ChatWidget />);
    expect(screen.getByText(/How can I help you today/)).toBeInTheDocument();
  });

  it('renders Grok title in header', () => {
    render(<ChatWidget />);
    expect(screen.getByText('Grok')).toBeInTheDocument();
  });

  it('renders input field and send button', () => {
    render(<ChatWidget />);

    const input = screen.getByPlaceholderText(/Message Grok/);
    expect(input).toBeInTheDocument();

    // Button has Send icon, find by role
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('submits message on button click', async () => {
    const mockSendMessage = jest.fn();
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: null,
      status: 'ready',
      sendMessage: mockSendMessage,
      setMessages: jest.fn(),
    });

    render(<ChatWidget customerId="test-customer" />);

    const input = screen.getByPlaceholderText(/Message Grok/);
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons[buttons.length - 1]; // Submit is last button

    fireEvent.change(input, { target: { value: 'Test query' } });
    fireEvent.click(submitButton);

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Test query' })
    ));

    // Input should be cleared after submit
    expect(input).toHaveValue('');
  });

  it('shows loading state during streaming', () => {
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ],
      error: null,
      status: 'streaming',
      sendMessage: jest.fn(),
      setMessages: jest.fn(),
    });

    render(<ChatWidget />);

    const input = screen.getByPlaceholderText(/Message Grok/);
    expect(input).toBeDisabled();

    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('handles error state', () => {
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: new Error('API error'),
      status: 'error',
      sendMessage: jest.fn(),
      setMessages: jest.fn(),
    });

    render(<ChatWidget />);

    expect(screen.getByText(/API error/)).toBeInTheDocument();
  });

  it('does not submit empty or whitespace-only input', () => {
    const mockSendMessage = jest.fn();
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: null,
      status: 'ready',
      sendMessage: mockSendMessage,
      setMessages: jest.fn(),
    });

    render(<ChatWidget />);

    const input = screen.getByPlaceholderText(/Message Grok/);
    const buttons = screen.getAllByRole('button');
    const submitButton = buttons[buttons.length - 1];

    // Try submitting whitespace-only
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(submitButton);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('displays xAI dark theme styling', () => {
    const { container } = render(<ChatWidget theme="dark" />);

    // Check for black background class in container
    const widget = container.firstChild as HTMLElement;
    expect(widget.className).toContain('bg-[#000000]');
  });

  it('displays user and assistant messages', () => {
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [
        { id: '1', role: 'assistant', parts: [{ type: 'text', text: 'Hello!' }] },
        { id: '2', role: 'user', parts: [{ type: 'text', text: 'Hi there' }] },
      ],
      error: null,
      status: 'ready',
      sendMessage: jest.fn(),
      setMessages: jest.fn(),
    });

    render(<ChatWidget />);

    expect(screen.getByText('Hello!')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();

    // Check Grok avatar exists (only assistant messages have avatars)
    const gAvatars = screen.getAllByText('G');
    expect(gAvatars.length).toBeGreaterThan(0);
  });
});