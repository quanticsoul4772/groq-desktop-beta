import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ChatContext, ChatProvider } from '../../../src/renderer/context/ChatContext';

// Mock component to test the context
const TestComponent = () => {
  const context = React.useContext(ChatContext);
  
  if (!context) {
    return <div>No context</div>;
  }
  
  const { 
    messages, 
    activeContext, 
    addMessage, 
    clearMessages, 
    updateLastMessage,
    setActiveContext 
  } = context;
  
  return (
    <div>
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="active-context">{activeContext || 'none'}</div>
      <button onClick={() => addMessage({ role: 'user', content: 'test' })}>
        Add Message
      </button>
      <button onClick={clearMessages}>
        Clear Messages
      </button>
      <button onClick={() => updateLastMessage({ content: 'updated' })}>
        Update Last
      </button>
      <button onClick={() => setActiveContext('test-context')}>
        Set Context
      </button>
      {messages.map((msg, index) => (
        <div key={index} data-testid={`message-${index}`}>
          {msg.role}: {msg.content}
        </div>
      ))}
    </div>
  );
};

describe('ChatContext', () => {
  test('provides context to children', () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
    expect(screen.getByTestId('active-context')).toHaveTextContent('none');
  });

  test('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useChatContext must be used within a ChatProvider');
    
    consoleSpy.mockRestore();
  });

  test('adds messages correctly', async () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    const addButton = screen.getByText('Add Message');
    
    await act(async () => {
      addButton.click();
    });
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('1');
    expect(screen.getByTestId('message-0')).toHaveTextContent('user: test');
  });

  test('clears messages correctly', async () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    const addButton = screen.getByText('Add Message');
    const clearButton = screen.getByText('Clear Messages');
    
    // Add a message first
    await act(async () => {
      addButton.click();
    });
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('1');
    
    // Clear messages
    await act(async () => {
      clearButton.click();
    });
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
  });

  test('updates last message correctly', async () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    const addButton = screen.getByText('Add Message');
    const updateButton = screen.getByText('Update Last');
    
    // Add a message first
    await act(async () => {
      addButton.click();
    });
    
    expect(screen.getByTestId('message-0')).toHaveTextContent('user: test');
    
    // Update the last message
    await act(async () => {
      updateButton.click();
    });
    
    expect(screen.getByTestId('message-0')).toHaveTextContent('user: updated');
  });

  test('sets active context correctly', async () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    const setContextButton = screen.getByText('Set Context');
    
    await act(async () => {
      setContextButton.click();
    });
    
    expect(screen.getByTestId('active-context')).toHaveTextContent('test-context');
  });

  test('handles multiple messages', async () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    const addButton = screen.getByText('Add Message');
    
    // Add multiple messages
    await act(async () => {
      addButton.click();
      addButton.click();
      addButton.click();
    });
    
    expect(screen.getByTestId('message-count')).toHaveTextContent('3');
    expect(screen.getByTestId('message-0')).toBeInTheDocument();
    expect(screen.getByTestId('message-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-2')).toBeInTheDocument();
  });

  test('handles message updates when no messages exist', async () => {
    render(
      <ChatProvider>
        <TestComponent />
      </ChatProvider>
    );
    
    const updateButton = screen.getByText('Update Last');
    
    // Try to update when no messages exist
    await act(async () => {
      updateButton.click();
    });
    
    // Should not crash and message count should remain 0
    expect(screen.getByTestId('message-count')).toHaveTextContent('0');
  });

  test('preserves message order', async () => {
    const OrderTestComponent = () => {
      const { messages, addMessage } = React.useContext(ChatContext);
      
      return (
        <div>
          <button onClick={() => addMessage({ role: 'user', content: 'first' })}>
            Add First
          </button>
          <button onClick={() => addMessage({ role: 'assistant', content: 'second' })}>
            Add Second
          </button>
          {messages.map((msg, index) => (
            <div key={index} data-testid={`ordered-message-${index}`}>
              {msg.content}
            </div>
          ))}
        </div>
      );
    };

    render(
      <ChatProvider>
        <OrderTestComponent />
      </ChatProvider>
    );
    
    const firstButton = screen.getByText('Add First');
    const secondButton = screen.getByText('Add Second');
    
    await act(async () => {
      firstButton.click();
      secondButton.click();
    });
    
    expect(screen.getByTestId('ordered-message-0')).toHaveTextContent('first');
    expect(screen.getByTestId('ordered-message-1')).toHaveTextContent('second');
  });

  test('handles complex message updates', async () => {
    const ComplexTestComponent = () => {
      const { messages, addMessage, updateLastMessage } = React.useContext(ChatContext);
      
      return (
        <div>
          <button onClick={() => addMessage({ 
            role: 'assistant', 
            content: 'initial', 
            isStreaming: true 
          })}>
            Add Streaming
          </button>
          <button onClick={() => updateLastMessage({ 
            content: 'complete', 
            isStreaming: false 
          })}>
            Complete Stream
          </button>
          {messages.map((msg, index) => (
            <div key={index} data-testid={`complex-message-${index}`}>
              {msg.content} - {msg.isStreaming ? 'streaming' : 'complete'}
            </div>
          ))}
        </div>
      );
    };

    render(
      <ChatProvider>
        <ComplexTestComponent />
      </ChatProvider>
    );
    
    const streamButton = screen.getByText('Add Streaming');
    const completeButton = screen.getByText('Complete Stream');
    
    await act(async () => {
      streamButton.click();
    });
    
    expect(screen.getByTestId('complex-message-0')).toHaveTextContent('initial - streaming');
    
    await act(async () => {
      completeButton.click();
    });
    
    expect(screen.getByTestId('complex-message-0')).toHaveTextContent('complete - complete');
  });
});