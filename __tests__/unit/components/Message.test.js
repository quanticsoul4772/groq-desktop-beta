import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
/* eslint-disable-next-line no-unused-vars */
import Message from '../../../src/renderer/components/Message';


// Mock MarkdownRenderer
jest.mock('../../../src/renderer/components/MarkdownRenderer', () => {
  return function MarkdownRenderer({ content }) {
    return <div data-testid="markdown-content">{content}</div>;
  };
});

// Mock ToolCall
jest.mock('../../../src/renderer/components/ToolCall', () => {
  return function ToolCall({ toolCall, toolResult, onExecute }) {
    return (
      <div data-testid="tool-call">
        <div>Tool: {toolCall.function.name}</div>
        <button onClick={() => onExecute && onExecute(toolCall)}>Execute</button>
        {toolResult && <div data-testid="tool-result">{toolResult}</div>}
      </div>
    );
  };
});

describe('Message', () => {
  const defaultProps = {
    onToolCallExecute: jest.fn(),
    allMessages: [],
    isLastMessage: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.log in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  test('renders user message', () => {
    const message = {
      role: 'user',
      content: 'Hello, how are you?',
    };

    render(<Message message={message} {...defaultProps} />);

    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Hello, how are you?');
    expect(screen.getByRole('img', { name: /user/i })).toBeInTheDocument();
  });

  test('renders assistant message', () => {
    const message = {
      role: 'assistant',
      content: 'I am doing well, thank you!',
    };

    render(<Message message={message} {...defaultProps} />);

    expect(screen.getByTestId('markdown-content')).toHaveTextContent('I am doing well, thank you!');
    expect(screen.getByRole('img', { name: /assistant/i })).toBeInTheDocument();
  });

  test('shows reasoning section when available', async () => {
    const user = userEvent.setup();
    const message = {
      role: 'assistant',
      content: 'Response content',
      reasoning: 'This is my reasoning process',
    };

    render(<Message message={message} {...defaultProps} />);

    const reasoningButton = screen.getByText(/show reasoning/i);
    expect(reasoningButton).toBeInTheDocument();

    await user.click(reasoningButton);

    expect(screen.getByText('This is my reasoning process')).toBeInTheDocument();
  });

  test('shows executed tools section when available', async () => {
    const user = userEvent.setup();
    const message = {
      role: 'assistant',
      content: 'Response content',
      executed_tools: [{ name: 'search', result: 'Search completed' }],
    };

    render(<Message message={message} {...defaultProps} />);

    const toolsButton = screen.getByText(/show executed tools/i);
    expect(toolsButton).toBeInTheDocument();

    await user.click(toolsButton);

    expect(screen.getByText('search')).toBeInTheDocument();
  });

  test('renders tool calls', () => {
    const message = {
      role: 'assistant',
      content: 'I need to call a tool',
      tool_calls: [
        {
          id: 'call_1',
          function: {
            name: 'search',
            arguments: '{"query": "test"}',
          },
        },
      ],
    };

    render(<Message message={message} {...defaultProps} />);

    expect(screen.getByTestId('tool-call')).toBeInTheDocument();
    expect(screen.getByText('Tool: search')).toBeInTheDocument();
  });

  test('finds and displays tool results', () => {
    const message = {
      role: 'assistant',
      content: 'Tool execution complete',
      tool_calls: [
        {
          id: 'call_1',
          function: { name: 'search', arguments: '{}' },
        },
      ],
    };

    const allMessages = [
      message,
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'Tool result content',
      },
    ];

    render(<Message message={message} allMessages={allMessages} {...defaultProps} />);

    expect(screen.getByTestId('tool-result')).toHaveTextContent('Tool result content');
  });

  test('handles tool call execution', async () => {
    const user = userEvent.setup();
    const mockOnToolCallExecute = jest.fn();
    const message = {
      role: 'assistant',
      content: 'Tool call message',
      tool_calls: [
        {
          id: 'call_1',
          function: { name: 'test_tool', arguments: '{}' },
        },
      ],
    };

    render(
      <Message message={message} onToolCallExecute={mockOnToolCallExecute} {...defaultProps} />
    );

    const executeButton = screen.getByText('Execute');
    await user.click(executeButton);

    expect(mockOnToolCallExecute).toHaveBeenCalledWith(message.tool_calls[0]);
  });

  test('shows streaming indicator', () => {
    const message = {
      role: 'assistant',
      content: 'Streaming...',
      isStreaming: true,
    };

    render(<Message message={message} {...defaultProps} />);

    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument();
  });

  test('displays live reasoning during streaming', () => {
    const message = {
      role: 'assistant',
      content: 'Response in progress',
      isStreaming: true,
      liveReasoning: 'Live reasoning content',
    };

    render(<Message message={message} {...defaultProps} />);

    // Should show live reasoning automatically during streaming
    expect(screen.getByText('Live reasoning content')).toBeInTheDocument();
  });

  test('displays live executed tools during streaming', () => {
    const message = {
      role: 'assistant',
      content: 'Tools executing',
      isStreaming: true,
      liveExecutedTools: [{ name: 'live_tool', result: 'Live result' }],
    };

    render(<Message message={message} {...defaultProps} />);

    expect(screen.getByText('live_tool')).toBeInTheDocument();
  });

  test('renders children when provided', () => {
    const message = {
      role: 'assistant',
      content: 'Message with children',
    };

    render(
      <Message message={message} {...defaultProps}>
        <div data-testid="child-component">Child content</div>
      </Message>
    );

    expect(screen.getByTestId('child-component')).toHaveTextContent('Child content');
  });

  test('toggles reasoning visibility', async () => {
    const user = userEvent.setup();
    const message = {
      role: 'assistant',
      content: 'Message content',
      reasoning: 'Detailed reasoning',
    };

    render(<Message message={message} {...defaultProps} />);

    const reasoningButton = screen.getByText(/show reasoning/i);

    // Initially hidden
    expect(screen.queryByText('Detailed reasoning')).not.toBeInTheDocument();

    // Show reasoning
    await user.click(reasoningButton);
    expect(screen.getByText('Detailed reasoning')).toBeInTheDocument();
    expect(screen.getByText(/hide reasoning/i)).toBeInTheDocument();

    // Hide reasoning again
    await user.click(screen.getByText(/hide reasoning/i));
    expect(screen.queryByText('Detailed reasoning')).not.toBeInTheDocument();
  });

  test('toggles executed tools visibility', async () => {
    const user = userEvent.setup();
    const message = {
      role: 'assistant',
      content: 'Message content',
      executed_tools: [{ name: 'test_tool', result: 'Tool output' }],
    };

    render(<Message message={message} {...defaultProps} />);

    const toolsButton = screen.getByText(/show executed tools/i);

    // Initially hidden
    expect(screen.queryByText('test_tool')).not.toBeInTheDocument();

    // Show tools
    await user.click(toolsButton);
    expect(screen.getByText('test_tool')).toBeInTheDocument();
    expect(screen.getByText(/hide executed tools/i)).toBeInTheDocument();

    // Hide tools again
    await user.click(screen.getByText(/hide executed tools/i));
    expect(screen.queryByText('test_tool')).not.toBeInTheDocument();
  });
});
