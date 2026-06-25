const { EventEmitter } = require('events');

class AsyncEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  async emitAsync(event, ...args) {
    const handlers = this.listeners(event);
    if (handlers.length === 0) return [];
    const results = [];
    for (const handler of handlers) {
      results.push(await handler(...args));
    }
    return results;
  }
}

module.exports = new AsyncEventBus();
