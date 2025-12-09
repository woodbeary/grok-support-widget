import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChatWidget from '../ChatWidget';

// Mock useChat hook for unit test
jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn(() => ({
    messages: [
      { id: '1', role: 'assistant', content: 'Hello! I am Grok...' },
    ],
    error: null,
    status: 'ready',
    sendMessage: jest.fn(),
  })),
}));

describe('ChatWidget', () => {
  it('renders initial message', () => {
    render(<ChatWidget />);
    expect(screen.getByText(/Hello! I am Grok/)).toBeInTheDocument();
  });

  it('submits message on enter and button click', async () => {
    const mockSendMessage = jest.fn();
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: null,
      status: 'ready',
      sendMessage: mockSendMessage,
    });

    render(<ChatWidget customerId="test-customer" />);

    const input = screen.getByPlaceholderText(/Ask Grok/);
    const button = screen.getByRole('button', { name: /send message/i });

    fireEvent.change(input, { target: { value: 'Test query' } });
    fireEvent.click(button);

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Test query' }),
      expect.objectContaining({ headers: { 'customer-id': 'test-customer' } })
    ));

    // Check input cleared
    expect(input).toHaveValue('');
  });

  it('shows loading state during streaming', () => {
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: null,
      status: 'streaming' as const,
      sendMessage: jest.fn(),
    });

    render(<ChatWidget />);

    const input = screen.getByPlaceholderText(/Ask Grok/);
    expect(input).toBeDisabled();

    expect(screen.getByText(/Grok is typing.../)).toBeInTheDocument();
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument(); // Assume Loader2 has data-testid if added
  });

  it('handles error state', () => {
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: new Error('API error'),
      status: 'error' as const,
      sendMessage: jest.fn(),
    });

    render(<ChatWidget />);

    expect(screen.getByText(/Error: API error/)).toBeInTheDocument();
  });

  it('passes theme prop', () => {
    render(<ChatWidget theme="dark" />);

    const card = screen.getByRole('generic', { name: /card/ }); // Or class
    expect(card).toHaveClass('dark'); // Assuming cn adds it
  });

  // Edge cases
  it('does not submit empty input', () => {
    const mockSendMessage = jest.fn();
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: null,
      status: 'ready',
      sendMessage: mockSendMessage,
    });

    render(<ChatWidget />);

    const input = screen.getByPlaceholderText(/Ask Grok/);
    const button = screen.getByRole('button', { name: /send message/i });

    fireEvent.change(input, { target: { value: '  ' } });
    fireEvent.click(button);

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('logs error via onError prop', () => {
    const mockOnError = jest.fn();
    (require('@ai-sdk/react').useChat as jest.Mock).mockReturnValue({
      messages: [],
      error: new Error('Test error'),
      status: 'error' as const,
      sendMessage: jest.fn(),
    });

    render(<ChatWidget onError={mockOnError} />);

    expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));
    expect(console.error).toHaveBeenCalledWith('Chat error:', expect.any(Error)); // From component
  });
});