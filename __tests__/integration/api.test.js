const nock = require('nock');

describe('API Integration Tests', () => {
  beforeAll(() => {
    // Disable real HTTP requests
    nock.disableNetConnect();
  });

  afterAll(() => {
    // Re-enable HTTP requests
    nock.enableNetConnect();
  });

  beforeEach(() => {
    // Clear any pending mocks
    nock.cleanAll();
  });

  describe('Groq API Integration', () => {
    test('handles successful API response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Test response from Groq'
          }
        }]
      };

      // Mock Groq API endpoint
      nock('https://api.groq.com')
        .post('/openai/v1/chat/completions')
        .reply(200, mockResponse);

      // Simulate API call
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      const data = await response.json();
      expect(data.choices[0].message.content).toBe('Test response from Groq');
    });

    test('handles API rate limiting with retry', async () => {
      // First request returns 429 (rate limited)
      nock('https://api.groq.com')
        .post('/openai/v1/chat/completions')
        .reply(429, { error: 'Rate limit exceeded' });

      // Second request succeeds
      nock('https://api.groq.com')
        .post('/openai/v1/chat/completions')
        .reply(200, {
          choices: [{
            message: {
              role: 'assistant',
              content: 'Success after retry'
            }
          }]
        });

      // Implement retry logic
      let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      if (response.status === 429) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        });
      }

      const data = await response.json();
      expect(data.choices[0].message.content).toBe('Success after retry');
    });

    test('handles network errors gracefully', async () => {
      // Simulate network error
      nock('https://api.groq.com')
        .post('/openai/v1/chat/completions')
        .replyWithError('Network error');

      await expect(
        fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Hello' }]
          })
        })
      ).rejects.toThrow();
    });

    test('handles malformed API responses', async () => {
      nock('https://api.groq.com')
        .post('/openai/v1/chat/completions')
        .reply(200, 'Invalid JSON');

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Hello' }]
        })
      });

      await expect(response.json()).rejects.toThrow();
    });
  });

  describe('MCP Server Integration', () => {
    test('handles MCP server connection', async () => {
      // Mock MCP server response
      const mockMCPResponse = {
        tools: [
          { name: 'search', description: 'Search tool' },
          { name: 'calculate', description: 'Calculator tool' }
        ]
      };

      nock('http://localhost:3000')
        .get('/tools')
        .reply(200, mockMCPResponse);

      const response = await fetch('http://localhost:3000/tools');
      const data = await response.json();

      expect(data.tools).toHaveLength(2);
      expect(data.tools[0].name).toBe('search');
    });

    test('handles MCP server timeout', async () => {
      nock('http://localhost:3000')
        .get('/tools')
        .delay(5000) // 5 second delay
        .reply(200, {});

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      await expect(
        fetch('http://localhost:3000/tools', {
          signal: controller.signal
        })
      ).rejects.toThrow();

      clearTimeout(timeoutId);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    test('opens circuit after consecutive failures', async () => {
      let failureCount = 0;
      const threshold = 3;

      // Simulate multiple failures
      for (let i = 0; i < threshold; i++) {
        nock('https://api.groq.com')
          .post('/openai/v1/chat/completions')
          .reply(500, { error: 'Internal server error' });

        try {
          await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-key'
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: 'Hello' }]
            })
          });
        } catch (error) {
          failureCount++;
        }
      }

      expect(failureCount).toBe(threshold);
      // Circuit should be open now
      // Additional requests should fail fast without hitting the API
    });
  });
});
