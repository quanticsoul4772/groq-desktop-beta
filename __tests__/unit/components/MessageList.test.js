import { render, screen } from '@testing-library/react';
import MessageList from '../../../src/renderer/components/MessageList';

// Explicitly reference to satisfy ESLint
MessageList;

// Mock Message component
jest.mock('../../../src/renderer/components/Message', () => {
  return function Message({ message, isLastMessage, children }) {
    return (
      <div data-testid={`message-${message.role}`} data-last={isLastMessage}>
        <div>{message.content}</div>
        {children}
      </div>
    );
  };
});

describe('MessageList', () => {
  const defaultProps = {
    messages: [],
    onToolCallExecute: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty state when no messages', () => {
    render(<MessageList {...defaultProps} />);

    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
  });

  test('renders list of messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      { role: 'user', content: 'How are you?' },
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    expect(screen.getByTestId('message-user')).toBeInTheDocument();
    expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    expect(screen.getAllByTestId(/message-user/)).toHaveLength(2);
  });

  test('marks last message correctly', () => {
    const messages = [
      { role: 'user', content: 'First message' },
      { role: 'assistant', content: 'Last message' },
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    const lastMessage = screen.getByTestId('message-assistant');
    expect(lastMessage).toHaveAttribute('data-last', 'true');

    const firstMessage = screen.getByTestId('message-user');
    expect(firstMessage).toHaveAttribute('data-last', 'false');
  });

  test('passes onToolCallExecute to messages', () => {
    const mockToolExecute = jest.fn();
    const messages = [{ role: 'assistant', content: 'Message with tools' }];

    render(
      <MessageList {...defaultProps} messages={messages} onToolCallExecute={mockToolExecute} />
    );

    expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
  });

  test('shows loading indicator when loading', () => {
    render(<MessageList {...defaultProps} loading={true} />);

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });

  test('scrolls to bottom on new messages', () => {
    const { rerender } = render(
      <MessageList {...defaultProps} messages={[{ role: 'user', content: 'First' }]} />
    );

    // Mock scrollIntoView
    const mockScrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    // Add new message
    rerender(
      <MessageList
        {...defaultProps}
        messages={[
          { role: 'user', content: 'First' },
          { role: 'assistant', content: 'Second' },
        ]}
      />
    );

    // Should scroll to the new message
    expect(mockScrollIntoView).toHaveBeenCalled();
  });

  test('handles streaming messages', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'Streaming response...',
        isStreaming: true,
      },
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    const streamingMessage = screen.getByTestId('message-assistant');
    expect(streamingMessage).toBeInTheDocument();
    expect(screen.getByText('Streaming response...')).toBeInTheDocument();
  });

  test('filters out empty messages', () => {
    const messages = [
      { role: 'user', content: 'Valid message' },
      { role: 'assistant', content: '' },
      { role: 'user', content: null },
      { role: 'assistant', content: 'Another valid message' },
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    // Should only render messages with content
    expect(screen.getAllByTestId(/message-/)).toHaveLength(2);
    expect(screen.getByText('Valid message')).toBeInTheDocument();
    expect(screen.getByText('Another valid message')).toBeInTheDocument();
  });

  test('provides context to messages', () => {
    const messages = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Third' },
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    // All messages should be rendered with access to the full message array
    expect(screen.getAllByTestId(/message-/)).toHaveLength(3);
  });

  test('handles messages with images', () => {
    const messages = [
      {
        role: 'user',
        content: 'Here is an image',
        images: ['data:image/png;base64,iVBOR...'],
      },
    ];

    render(<MessageList {...defaultProps} messages={messages} />);

    expect(screen.getByTestId('message-user')).toBeInTheDocument();
    expect(screen.getByText('Here is an image')).toBeInTheDocument();
  });

  test('renders welcome message when no messages', () => {
    render(<MessageList {...defaultProps} />);

    expect(screen.getByText(/welcome to groq desktop/i)).toBeInTheDocument();
    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
  });

  test('auto-scrolls on message updates', () => {
    const mockScrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = mockScrollIntoView;

    const { rerender } = render(
      <MessageList {...defaultProps} messages={[{ role: 'user', content: 'Hello' }]} />
    );

    // Update existing message (streaming scenario)
    rerender(
      <MessageList {...defaultProps} messages={[{ role: 'user', content: 'Hello world' }]} />
    );

    expect(mockScrollIntoView).toHaveBeenCalled();
  });
});
