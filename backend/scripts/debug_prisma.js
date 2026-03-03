const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Inspecting UserDevice fields...');
    try {
        // Attempt to access the composite field name by looking at the schema-like object if available
        // or just try common names in a findUnique call (it will throw with helpful msg if wrong)
        await prisma.userDevice.findUnique({
            where: {
                userId_deviceFingerprint: {
                    userId: '00000000-0000-0000-0000-000000000000',
                    deviceFingerprint: 'test'
                }
            }
        });
        console.log('userId_deviceFingerprint IS valid.');
    } catch (err) {
        console.log('Error Message:', err.message);
    }
    process.exit(0);
}

check();
