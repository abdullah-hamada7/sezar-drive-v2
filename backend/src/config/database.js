// Prisma Client configuration

const { PrismaClient } = require('@prisma/client');

let _prisma;

function getPrisma() {
  if (!_prisma) {
    try {
      _prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      });
    } catch (e) {
      console.error('Prisma initialization failed:', e);
      // In test environment without DB, provide a stub
      if (process.env.NODE_ENV === 'test') {
        console.warn('PrismaClient could not be initialized - using stub for tests');
        _prisma = new Proxy({}, {
          get: (_, prop) => {
            if (prop === '$connect' || prop === '$disconnect' || prop === '$on' || prop === '$use' || prop === '$transaction') {
              return () => Promise.resolve();
            }
            // For model access (e.g., prisma.user.findFirst)
            return new Proxy({}, {
              get: () => () => Promise.resolve(null),
            });
          },
        });
      } else {
        throw e;
      }
    }
  }
  return _prisma;
}

// Export a proxy that delegates all property access to the lazy prisma instance
module.exports = new Proxy({}, {
  get: (_, prop) => getPrisma()[prop],
});
