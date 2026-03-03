const { PrismaClient } = require('@prisma/client');
const { getRuntime } = require('@prisma/client/runtime/library');

describe('Prisma Debug Test', () => {
  it('should inspect PrismaClient runtime', () => {
    console.log('--- Jest Prisma Diagnostic ---');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    const runtime = getRuntime();
    console.log('getRuntime().type:', runtime.type);
    console.log('getRuntime().wasm:', !!runtime.wasm);

    try {
      const prisma = new PrismaClient();
      console.log('PrismaClient initialized successfully in Jest.');
      prisma.$disconnect();
    } catch (e) {
      console.log('Caught error in Jest:', e.message);
      if (e.stack) {
        console.log('Stack Trace Snippet:', e.stack.split('\n').slice(0, 5).join('\n'));
      }
      throw e;
    }
    console.log('--- End Jest Diagnostic ---');
  });
});
