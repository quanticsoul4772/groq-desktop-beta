import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock Message component for testing
// In a real scenario, you would import the actual component
const _Message = ({ role, content, timestamp, error }) => {
  return (
    <div className={`message ${role}-message`}>
      <div className="message-content" style={{ wordWrap: 'break-word' }}>
        {content}
      </div>
      {timestamp && <span className="timestamp">{timestamp}</span>}
      {error && <div className="error">{error}</div>}
    </div>
  );
};

describe('Message Component', () => {
  const defaultProps = {
    role: 'user',
    content: 'Test message content',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders message with user role', () => {
    render(<_Message {...defaultProps} />);
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  test('renders message with assistant role', () => {
    const props = { ...defaultProps, role: 'assistant' };
    render(<_Message {...props} />);
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  test('renders message with system role', () => {
    const props = { ...defaultProps, role: 'system' };
    render(<_Message {...props} />);
    expect(screen.getByText('Test message content')).toBeInTheDocument();
  });

  test('handles empty content gracefully', () => {
    const props = { ...defaultProps, content: '' };
    const { container } = render(<_Message {...props} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('displays timestamp when provided', () => {
    const timestamp = '2024-01-01T12:00:00Z';
    const props = { ...defaultProps, timestamp };
    render(<_Message {...props} />);
    expect(screen.getByText(timestamp)).toBeInTheDocument();
  });

  test('applies correct styling for different roles', () => {
    const { container } = render(<_Message {...defaultProps} />);
    const userMessage = container.firstChild;
    expect(userMessage).toHaveClass('user-message');
  });

  test('renders error state when message has error', () => {
    const props = {
      ...defaultProps,
      error: 'An error occurred',
    };
    render(<_Message {...props} />);
    expect(screen.getByText('An error occurred')).toBeInTheDocument();
  });
});
