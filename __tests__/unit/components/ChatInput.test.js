import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatContext } from '../../../src/renderer/context/ChatContext';
import ChatInput from '../../../src/renderer/components/ChatInput';

// Mock the ChatContext
const mockChatContext = {
  messages: [],
  activeContext: null,
  clearMessages: jest.fn(),
  addMessage: jest.fn()
};

const ChatInputWrapper = ({ children, contextValue = mockChatContext }) => (
  <ChatContext.Provider value={contextValue}>
    {children}
  </ChatContext.Provider>
);

describe('ChatInput', () => {
  const defaultProps = {
    onSendMessage: jest.fn(),
    loading: false,
    visionSupported: true,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    selectedModel: 'llama-3.3-70b-versatile',
    onModelChange: jest.fn(),
    onOpenMcpTools: jest.fn(),
    modelConfigs: {
      'llama-3.3-70b-versatile': { vision: true },
      'llama-3.1-8b-instant': { vision: false }
    },
    enableSpellCheck: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders chat input component', () => {
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} />
      </ChatInputWrapper>
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  test('allows typing in the textarea', async () => {
    const user = userEvent.setup();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} />
      </ChatInputWrapper>
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello world');
    
    expect(textarea.value).toBe('Hello world');
  });

  test('calls onSendMessage when form is submitted', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} onSendMessage={mockSendMessage} />
      </ChatInputWrapper>
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message');
    
    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);
    
    expect(mockSendMessage).toHaveBeenCalledWith('Test message', []);
  });

  test('prevents sending empty messages', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} onSendMessage={mockSendMessage} />
      </ChatInputWrapper>
    );

    const sendButton = screen.getByRole('button', { name: /send/i });
    await user.click(sendButton);
    
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  test('shows loading state', () => {
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} loading={true} />
      </ChatInputWrapper>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  test('disables input and button when loading', () => {
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} loading={true} />
      </ChatInputWrapper>
    );

    const textarea = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    expect(textarea).toBeDisabled();
    expect(sendButton).toBeDisabled();
  });

  test('handles model selection', async () => {
    const user = userEvent.setup();
    const mockModelChange = jest.fn();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} onModelChange={mockModelChange} />
      </ChatInputWrapper>
    );

    const selectTrigger = screen.getByRole('combobox');
    await user.click(selectTrigger);
    
    // Wait for dropdown to appear
    await waitFor(() => {
      expect(screen.getByText('llama-3.1-8b-instant')).toBeInTheDocument();
    });
    
    const modelOption = screen.getByText('llama-3.1-8b-instant');
    await user.click(modelOption);
    
    expect(mockModelChange).toHaveBeenCalledWith('llama-3.1-8b-instant');
  });

  test('handles file upload', async () => {
    const user = userEvent.setup();
    const file = new File(['test'], 'test.png', { type: 'image/png' });
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} />
      </ChatInputWrapper>
    );

    const fileInput = screen.getByTestId('file-input');
    await user.upload(fileInput, file);
    
    await waitFor(() => {
      expect(screen.getByText('test.png')).toBeInTheDocument();
    });
  });

  test('shows MCP tools button when available', () => {
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} />
      </ChatInputWrapper>
    );

    const mcpButton = screen.getByRole('button', { name: /mcp tools/i });
    expect(mcpButton).toBeInTheDocument();
  });

  test('calls onOpenMcpTools when MCP tools button is clicked', async () => {
    const user = userEvent.setup();
    const mockOpenMcpTools = jest.fn();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} onOpenMcpTools={mockOpenMcpTools} />
      </ChatInputWrapper>
    );

    const mcpButton = screen.getByRole('button', { name: /mcp tools/i });
    await user.click(mcpButton);
    
    expect(mockOpenMcpTools).toHaveBeenCalled();
  });

  test('handles Enter key submission', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} onSendMessage={mockSendMessage} />
      </ChatInputWrapper>
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');
    
    expect(mockSendMessage).toHaveBeenCalledWith('Test message', []);
  });

  test('handles Shift+Enter for new line', async () => {
    const user = userEvent.setup();
    const mockSendMessage = jest.fn();
    
    render(
      <ChatInputWrapper>
        <ChatInput {...defaultProps} onSendMessage={mockSendMessage} />
      </ChatInputWrapper>
    );

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Line 1');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await user.type(textarea, 'Line 2');
    
    expect(textarea.value).toContain('\n');
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});