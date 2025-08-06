const nock = require('nock');

// Setup nock for API mocking
beforeAll(() => {
  // Ensure nock is active
  if (!nock.isActive()) {
    nock.activate();
  }
});

beforeEach(() => {
  // Clean all HTTP mocks before each test
  nock.cleanAll();
});

afterAll(() => {
  // Clean up and restore HTTP
  nock.cleanAll();
  nock.restore();
});

// Mock Groq API
const mockGroqAPI = () => {
  return nock('https://api.groq.com')
    .defaultReplyHeaders({
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true'
    });
};

// Mock successful Groq chat completion
const mockGroqChatSuccess = (response = {
  choices: [{ message: { content: 'Mock response' } }],
  usage: { total_tokens: 10 }
}) => {
  return mockGroqAPI()
    .post('/openai/v1/chat/completions')
    .reply(200, response);
};

// Mock Groq API errors
const mockGroqError = (statusCode = 500, error = 'Internal Server Error') => {
  return mockGroqAPI()
    .post('/openai/v1/chat/completions')
    .reply(statusCode, { error: { message: error } });
};

// Mock rate limiting (429)
const mockGroqRateLimit = () => {
  return mockGroqAPI()
    .post('/openai/v1/chat/completions')
    .reply(429, { 
      error: { 
        message: 'Rate limit exceeded',
        type: 'rate_limit_error'
      } 
    });
};

// Mock timeout
const mockGroqTimeout = () => {
  return mockGroqAPI()
    .post('/openai/v1/chat/completions')
    .delay(30000) // 30 second delay to trigger timeout
    .reply(200, { choices: [{ message: { content: 'Late response' } }] });
};

// Mock circuit breaker behavior
const mockCircuitBreakerSequence = () => {
  return [
    mockGroqError(503, 'Service Unavailable'), // First failure
    mockGroqError(503, 'Service Unavailable'), // Second failure  
    mockGroqError(503, 'Service Unavailable'), // Third failure - should open circuit
    mockGroqChatSuccess(), // This should be blocked by circuit breaker
    mockGroqChatSuccess()  // After cooldown, should work again
  ];
};

// Export mocking utilities
global.mockGroqAPI = mockGroqAPI;
global.mockGroqChatSuccess = mockGroqChatSuccess;
global.mockGroqError = mockGroqError;
global.mockGroqRateLimit = mockGroqRateLimit;
global.mockGroqTimeout = mockGroqTimeout;
global.mockCircuitBreakerSequence = mockCircuitBreakerSequence;

// Mock metrics collection
global.mockMetrics = {
  counters: new Map(),
  gauges: new Map(),
  histograms: new Map(),
  
  increment: function(name, labels = {}) {
    const key = `${name}_${JSON.stringify(labels)}`;
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  },
  
  set: function(name, value, labels = {}) {
    const key = `${name}_${JSON.stringify(labels)}`;
    this.gauges.set(key, value);
  },
  
  observe: function(name, value, labels = {}) {
    const key = `${name}_${JSON.stringify(labels)}`;
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key).push(value);
  },
  
  clear: function() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
};