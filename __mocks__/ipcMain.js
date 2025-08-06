const handlers = {};

const mockIpcMain = {
  handle: (channel, fn) => {
    handlers[channel] = fn;
  },
  
  _invoke: (channel, ...args) => {
    const handler = handlers[channel];
    if (handler) {
      return handler(...args);
    }
    throw new Error(`No handler registered for channel: ${channel}`);
  },
  
  _reset: () => {
    Object.keys(handlers).forEach(key => delete handlers[key]);
  }
};

module.exports = mockIpcMain;