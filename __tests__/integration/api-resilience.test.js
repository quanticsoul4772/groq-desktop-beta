const nock = require('nock');

describe('API Resilience Integration Tests', () => {
  const API_BASE_URL = 'https://api.groq.com';
  
  beforeEach(() => {
    // Ensure clean state
    nock.cleanAll();
    global.mockMetrics.clear();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Retry Logic', () => {
    test('retries on 5xx server errors', async () => {
      // Mock first call to return 503, second call to succeed
      const scope1 = mockGroqError(503, 'Service Unavailable');
      const scope2 = mockGroqChatSuccess();

      // Simulate API client with retry logic
      const makeApiCall = async () => {
        let attempts = 0;
        const maxRetries = 3;
        
        while (attempts < maxRetries) {
          try {
            const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
            });
            
            if (!response.ok && response.status >= 500) {
              attempts++;
              if (attempts >= maxRetries) {
                throw new Error(`API call failed after ${maxRetries} attempts`);
              }
              // Wait before retry (exponential backoff simulation)
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
              continue;
            }
            
            return await response.json();
          } catch (error) {
            attempts++;
            if (attempts >= maxRetries) throw error;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 100));
          }
        }
      };

      const result = await makeApiCall();
      
      expect(result.choices[0].message.content).toBe('Mock response');
      expect(scope1.isDone()).toBe(true);
      expect(scope2.isDone()).toBe(true);
    });

    test('does not retry on 4xx client errors', async () => {
      const scope = mockGroqError(400, 'Bad Request');

      const makeApiCall = async () => {
        const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
        });
        
        if (!response.ok && response.status >= 400 && response.status < 500) {
          // Don't retry client errors
          const error = await response.json();
          throw new Error(error.error.message);
        }
        
        return await response.json();
      };

      await expect(makeApiCall()).rejects.toThrow('Bad Request');
      expect(scope.isDone()).toBe(true);
    });

    test('implements exponential backoff', async () => {
      const startTime = Date.now();
      
      // Mock multiple failures
      mockGroqError(503, 'Service Unavailable');
      mockGroqError(503, 'Service Unavailable');
      mockGroqChatSuccess();

      const makeApiCallWithBackoff = async () => {
        let attempts = 0;
        const maxRetries = 3;
        
        while (attempts < maxRetries) {
          try {
            const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
            });
            
            if (!response.ok && response.status >= 500) {
              attempts++;
              if (attempts >= maxRetries) throw new Error('Max retries exceeded');
              
              // Exponential backoff: 100ms, 200ms, 400ms
              const delay = Math.pow(2, attempts) * 100;
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            
            return await response.json();
          } catch (error) {
            attempts++;
            if (attempts >= maxRetries) throw error;
          }
        }
      };

      const result = await makeApiCallWithBackoff();
      const endTime = Date.now();
      
      // Should have taken at least 300ms (100 + 200) for two retries
      expect(endTime - startTime).toBeGreaterThan(250);
      expect(result.choices[0].message.content).toBe('Mock response');
    });
  });

  describe('Rate Limit Handling', () => {
    test('handles 429 rate limit errors', async () => {
      const rateLimitScope = mockGroqRateLimit();
      
      const makeApiCall = async () => {
        const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
        });
        
        if (response.status === 429) {
          const error = await response.json();
          throw new Error(`Rate limit exceeded: ${error.error.message}`);
        }
        
        return await response.json();
      };

      await expect(makeApiCall()).rejects.toThrow('Rate limit exceeded');
      expect(rateLimitScope.isDone()).toBe(true);
    });

    test('respects rate limit headers', async () => {
      const scope = nock(API_BASE_URL)
        .post('/openai/v1/chat/completions')
        .reply(429, 
          { error: { message: 'Rate limit exceeded' } },
          { 
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60)
          }
        );

      const makeApiCallWithRateLimit = async () => {
        const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
        });
        
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const remaining = response.headers.get('X-RateLimit-Remaining');
          
          return {
            status: 'rate_limited',
            retryAfter: parseInt(retryAfter),
            remaining: parseInt(remaining)
          };
        }
        
        return await response.json();
      };

      const result = await makeApiCallWithRateLimit();
      
      expect(result.status).toBe('rate_limited');
      expect(result.retryAfter).toBe(60);
      expect(result.remaining).toBe(0);
      expect(scope.isDone()).toBe(true);
    });
  });

  describe('Circuit Breaker Pattern', () => {
    test('opens circuit after consecutive failures', async () => {
      let circuitOpen = false;
      let failureCount = 0;
      const maxFailures = 3;
      const cooldownPeriod = 1000; // 1 second
      let lastFailureTime = 0;

      // Mock consecutive failures
      mockGroqError(503, 'Service Unavailable');
      mockGroqError(503, 'Service Unavailable');
      mockGroqError(503, 'Service Unavailable');

      const makeApiCallWithCircuitBreaker = async () => {
        const now = Date.now();
        
        // Check if circuit is open and cooldown period has passed
        if (circuitOpen && (now - lastFailureTime) > cooldownPeriod) {
          circuitOpen = false;
          failureCount = 0;
        }
        
        // If circuit is open, fail fast
        if (circuitOpen) {
          throw new Error('Circuit breaker is open');
        }
        
        try {
          const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
          });
          
          if (!response.ok && response.status >= 500) {
            failureCount++;
            lastFailureTime = now;
            
            if (failureCount >= maxFailures) {
              circuitOpen = true;
            }
            
            const error = await response.json();
            throw new Error(error.error.message);
          }
          
          // Reset failure count on success
          failureCount = 0;
          return await response.json();
        } catch (error) {
          failureCount++;
          lastFailureTime = now;
          
          if (failureCount >= maxFailures) {
            circuitOpen = true;
          }
          
          throw error;
        }
      };

      // Make 3 calls to trigger circuit breaker
      await expect(makeApiCallWithCircuitBreaker()).rejects.toThrow('Service Unavailable');
      await expect(makeApiCallWithCircuitBreaker()).rejects.toThrow('Service Unavailable');
      await expect(makeApiCallWithCircuitBreaker()).rejects.toThrow('Service Unavailable');
      
      // Circuit should now be open
      expect(circuitOpen).toBe(true);
      
      // Next call should fail fast without hitting the API
      await expect(makeApiCallWithCircuitBreaker()).rejects.toThrow('Circuit breaker is open');
    });

    test('half-opens circuit after cooldown period', async () => {
      let circuitOpen = true;
      let failureCount = 3;
      const cooldownPeriod = 100; // Short period for testing
      let lastFailureTime = Date.now() - cooldownPeriod - 10; // Past cooldown

      // Mock successful response for half-open test
      mockGroqChatSuccess();

      const makeApiCallWithCircuitBreaker = async () => {
        const now = Date.now();
        
        // Check if circuit can be half-opened
        if (circuitOpen && (now - lastFailureTime) > cooldownPeriod) {
          circuitOpen = false;
          failureCount = 0;
        }
        
        if (circuitOpen) {
          throw new Error('Circuit breaker is open');
        }
        
        const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
        });
        
        return await response.json();
      };

      const result = await makeApiCallWithCircuitBreaker();
      
      expect(result.choices[0].message.content).toBe('Mock response');
      expect(circuitOpen).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    test('handles request timeouts', async () => {
      const timeoutScope = mockGroqTimeout();

      const makeApiCallWithTimeout = async (timeoutMs = 1000) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        try {
          const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error('Request timeout');
          }
          throw error;
        }
      };

      await expect(makeApiCallWithTimeout(500)).rejects.toThrow('Request timeout');
      
      // Cleanup the pending nock
      nock.cleanAll();
    });
  });

  describe('Metrics Collection', () => {
    test('collects API call metrics', async () => {
      mockGroqChatSuccess();

      const makeApiCallWithMetrics = async () => {
        const startTime = Date.now();
        
        try {
          global.mockMetrics.increment('api_calls_total', { status: 'started' });
          
          const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
          });
          
          const duration = Date.now() - startTime;
          
          if (response.ok) {
            global.mockMetrics.increment('api_calls_total', { status: 'success' });
            global.mockMetrics.observe('api_call_duration', duration, { status: 'success' });
          } else {
            global.mockMetrics.increment('api_calls_total', { status: 'error' });
            global.mockMetrics.observe('api_call_duration', duration, { status: 'error' });
          }
          
          return await response.json();
        } catch (error) {
          const duration = Date.now() - startTime;
          global.mockMetrics.increment('api_calls_total', { status: 'error' });
          global.mockMetrics.observe('api_call_duration', duration, { status: 'error' });
          throw error;
        }
      };

      await makeApiCallWithMetrics();

      // Verify metrics were collected
      expect(global.mockMetrics.counters.get('api_calls_total_{"status":"started"}')).toBe(1);
      expect(global.mockMetrics.counters.get('api_calls_total_{"status":"success"}')).toBe(1);
      expect(global.mockMetrics.histograms.get('api_call_duration_{"status":"success"}')).toBeDefined();
    });

    test('collects retry metrics', async () => {
      // Mock failure then success
      mockGroqError(503, 'Service Unavailable');
      mockGroqChatSuccess();

      const makeApiCallWithRetryMetrics = async () => {
        let attempts = 0;
        const maxRetries = 3;
        
        while (attempts < maxRetries) {
          attempts++;
          global.mockMetrics.increment('api_retry_attempts', { attempt: attempts });
          
          try {
            const response = await fetch(`${API_BASE_URL}/openai/v1/chat/completions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] })
            });
            
            if (response.ok) {
              global.mockMetrics.increment('api_retry_success', { final_attempt: attempts });
              return await response.json();
            } else if (response.status >= 500) {
              if (attempts >= maxRetries) {
                global.mockMetrics.increment('api_retry_exhausted');
                throw new Error('Max retries exceeded');
              }
              continue;
            }
          } catch (error) {
            if (attempts >= maxRetries) {
              global.mockMetrics.increment('api_retry_exhausted');
              throw error;
            }
          }
        }
      };

      await makeApiCallWithRetryMetrics();

      // Verify retry metrics
      expect(global.mockMetrics.counters.get('api_retry_attempts_{"attempt":1}')).toBe(1);
      expect(global.mockMetrics.counters.get('api_retry_attempts_{"attempt":2}')).toBe(1);
      expect(global.mockMetrics.counters.get('api_retry_success_{"final_attempt":2}')).toBe(1);
    });
  });
});