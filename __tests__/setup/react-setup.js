import '@testing-library/jest-dom';

// Mock Next.js themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: jest.fn(),
    resolvedTheme: 'light'
  }),
  ThemeProvider: ({ children }) => children
}));

// Mock React Router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/' }),
  BrowserRouter: ({ children }) => children,
  Routes: ({ children }) => children,
  Route: ({ children }) => children
}));

// Mock Electron IPC
global.electronAPI = {
  sendMessage: jest.fn(() => Promise.resolve()),
  onMessage: jest.fn(),
  setApiKey: jest.fn(),
  getApiKey: jest.fn(() => Promise.resolve('')),
  getSettings: jest.fn(() => Promise.resolve({})),
  setSettings: jest.fn(),
  openExternal: jest.fn(),
  showContextMenu: jest.fn()
};

// Mock CSS imports
jest.mock('../../src/renderer/index.css', () => ({}));

// Setup DOM environment
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));