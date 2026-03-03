require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

function isTruthyEnv(name) {
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(process.env[name] || '').toLowerCase());
}

function generatePassword() {
  // URL-safe, no spaces; good enough for a one-time dev seed.
  return crypto.randomBytes(24).toString('base64url');
}

async function main() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  // NOTE: Never ship hardcoded credentials. Provide them via env.
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const adminPhone = (process.env.SEED_ADMIN_PHONE || '0000000000').trim();
  const providedPassword = process.env.SEED_ADMIN_PASSWORD;
  const overwriteAdminPassword = isTruthyEnv('SEED_OVERWRITE_ADMIN_PASSWORD');
  const overwriteConfig = isTruthyEnv('SEED_OVERWRITE_CONFIG');

  // Dangerous operation: full reset REMOVED per user request.
  // const resetDb = isTruthyEnv('SEED_RESET_DB');

  if (isProduction && !providedPassword) {
    throw new Error('Refusing to seed in production without SEED_ADMIN_PASSWORD');
  }

  console.log('🌱 Starting database seeding...');

  try {
    console.log('  ℹ️ Automated data deletion is disabled for safety.');

    // 1. Super Admin upsert
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    let admin;
    let didSetAdminPassword = false;
    let adminPasswordPlain = null;

    if (existingAdmin) {
      admin = existingAdmin;
      if (overwriteAdminPassword) {
        adminPasswordPlain = providedPassword || (isProduction ? null : generatePassword());
        const adminPasswordHash = await bcrypt.hash(adminPasswordPlain, 12);
        await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { passwordHash: adminPasswordHash, mustChangePassword: false, adminRole: 'SUPER_ADMIN' },
        });
        didSetAdminPassword = true;
        console.log(`  ✅ Super Admin password updated (SEED_OVERWRITE_ADMIN_PASSWORD=true): ${admin.email}`);
      } else {
        console.log(`  ✅ Super Admin exists: ${admin.email}`);
      }
    } else {
      adminPasswordPlain = providedPassword || (isProduction ? null : generatePassword());
      const adminPasswordHash = await bcrypt.hash(adminPasswordPlain, 12);
      admin = await prisma.user.create({
        data: {
          email: adminEmail,
          phone: adminPhone,
          name: process.env.SEED_ADMIN_NAME || 'Super Admin',
          passwordHash: adminPasswordHash,
          role: 'admin',
          adminRole: 'SUPER_ADMIN',
          mustChangePassword: false,
          identityVerified: true,
          isActive: true,
        },
      });
      didSetAdminPassword = true;
      console.log(`  ✅ Super Admin created: ${admin.email}`);
    }

    // 2. Create 5 standard Admins
    console.log('  ℹ️ Ensuring 5 standard admin accounts exist...');
    const defaultPasswordHash = await bcrypt.hash('StandardAdmin123!', 12);
    for (let i = 1; i <= 5; i++) {
      const email = `admin${i}@sezar.com`;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            email,
            phone: `000000001${i}`,
            name: `Standard Admin ${i}`,
            passwordHash: defaultPasswordHash,
            role: 'admin',
            adminRole: 'ADMIN',
            mustChangePassword: true,
            identityVerified: true,
            isActive: true,
          }
        });
      }
    }
    console.log('  ✅ 5 standard admins ensured.');

    // 3. Create default expense categories
    const defaultCategories = [
      { name: 'Fuel', requiresApproval: false },
      { name: 'Tolls', requiresApproval: false },
      { name: 'Maintenance', requiresApproval: true },
      { name: 'Car Wash', requiresApproval: false },
      { name: 'Parking', requiresApproval: false },
      { name: 'Meals', requiresApproval: true },
      { name: 'Other', requiresApproval: true },
    ];

    await prisma.expenseCategory.createMany({
      data: defaultCategories,
      skipDuplicates: true,
    });
    console.log('  ✅ Expense categories ensured.');

    // 4. Seed platform config keys (idempotent)
    const inspectionPolicy = {
      first_shift_of_day: 'full',
      subsequent_trips: 'checklist',
      damage_reported: 'full',
      vehicle_reassigned: 'full',
    };

    const defaultConfig = [
      { key: 'shift_auto_timeout_hours', value: 14 },
      { key: 'tracking_interval_seconds', value: 30 },
      { key: 'max_report_days', value: 90 },
      { key: 'inspection_policy', value: inspectionPolicy },
    ];

    for (const item of defaultConfig) {
      const existing = await prisma.adminConfig.findUnique({ where: { key: item.key } });
      if (!existing) {
        await prisma.adminConfig.create({
          data: {
            key: item.key,
            value: item.value,
            updatedBy: admin?.id || null,
          },
        });
      } else if (overwriteConfig) {
        await prisma.adminConfig.update({
          where: { key: item.key },
          data: {
            value: item.value,
            updatedBy: admin?.id || existing.updatedBy || null,
          },
        });
      }
    }
    console.log(`  ✅ Admin config ensured${overwriteConfig ? ' (overwritten)' : ''}.`);

    console.log('\n🎉 Seed completed successfully!');
    if (!isProduction) {
      console.log('\n📋 Seeded admin credentials (dev only):');
      console.log(`  Email: ${adminEmail}`);
      if (didSetAdminPassword) {
        if (!providedPassword) {
          console.log(`  Password (generated): ${adminPasswordPlain}`);
          console.log('  TIP: set SEED_ADMIN_PASSWORD to control this value.');
        } else {
          console.log('  Password: (from SEED_ADMIN_PASSWORD)');
        }
      } else {
        console.log('  Password: (unchanged; admin already existed)');
      }
    }

  } catch (error) {
    console.error('\n❌ Seeding Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
