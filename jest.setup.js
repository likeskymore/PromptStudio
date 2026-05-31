// jest.setup.js
// Provide fake API keys so tests that check env vars don't skip
process.env.OPENAI_API_KEY = 'test';
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';
process.env.AWS_SESSION_TOKEN = 'test';

// Mock the backend.queryLLM so tests never call real LLMs
try {
  const backend = require('./backend/backend');
  if (backend && backend.queryLLM) {
    jest.spyOn(backend, 'queryLLM').mockImplementation(async () => {
      return {
        responses: [
          {
            vars: {},
            metavars: {},
            llm: {},
            prompt: '',
            // Return a plain string response that looks like a markdown list
            responses: ['- mock item 1\n- mock item 2\n- mock item 3'],
            tokens: {},
            uid: 'mock-1',
          },
        ],
        errors: {},
      };
    });
  }
} catch (e) {
  // noop: if require fails during some tooling, don't crash setup
}
