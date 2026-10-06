import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Starting HomeExpense deterministic database seed...');

  // Clean existing seed data safely
  await prisma.auditLog.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.expenseSplit.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.homeMember.deleteMany();
  await prisma.home.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 1. Seed Users
  console.log('[SEED] Creating seed users...');
  const rohan = await prisma.user.create({
    data: {
      email: 'rohan@example.com',
      name: 'Rohan Sharma',
      passwordHash,
    },
  });

  const amit = await prisma.user.create({
    data: {
      email: 'amit@example.com',
      name: 'Amit Patel',
      passwordHash,
    },
  });

  const kabir = await prisma.user.create({
    data: {
      email: 'kabir@example.com',
      name: 'Kabir Verma',
      passwordHash,
    },
  });

  const priya = await prisma.user.create({
    data: {
      email: 'priya@example.com',
      name: 'Priya Sharma',
      passwordHash,
    },
  });

  console.log('[SEED] Users created: Rohan, Amit, Kabir, Priya.');

  // 2. Seed Bachelor Home: "402 Pinecrest Flat"
  console.log('[SEED] Creating Bachelor Home (Pinecrest Flat)...');
  const bachelorHome = await prisma.home.create({
    data: {
      name: '402 Pinecrest Flat',
      type: 'BACHELOR',
      currency: 'INR',
      description: '3BHK Flatmates expense sharing and bill splitting',
    },
  });

  const mRohan = await prisma.homeMember.create({
    data: { homeId: bachelorHome.id, userId: rohan.id, role: 'OWNER' },
  });

  const mAmit = await prisma.homeMember.create({
    data: { homeId: bachelorHome.id, userId: amit.id, role: 'ADMIN' },
  });

  const mKabir = await prisma.homeMember.create({
    data: { homeId: bachelorHome.id, userId: kabir.id, role: 'MEMBER' },
  });

  // 3. Seed Expenses & Ledger for Bachelor Home
  // Expense 1: Fiber Internet (₹1,500 - Paid by Rohan, split equally ₹500 each)
  const exp1 = await prisma.expense.create({
    data: {
      homeId: bachelorHome.id,
      payerMemberId: mRohan.id,
      amount: new Prisma.Decimal(1500.0),
      description: 'Fiber High-Speed Internet',
      category: 'UTILITIES',
      splitType: 'EQUAL',
      date: new Date('2026-10-01T10:00:00Z'),
    },
  });

  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: exp1.id, memberId: mRohan.id, amount: new Prisma.Decimal(500.0) },
      { expenseId: exp1.id, memberId: mAmit.id, amount: new Prisma.Decimal(500.0) },
      { expenseId: exp1.id, memberId: mKabir.id, amount: new Prisma.Decimal(500.0) },
    ],
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        homeId: bachelorHome.id,
        expenseId: exp1.id,
        debtorMemberId: mAmit.id,
        creditorMemberId: mRohan.id,
        amount: new Prisma.Decimal(500.0),
        notes: 'Split for Fiber Internet',
      },
      {
        homeId: bachelorHome.id,
        expenseId: exp1.id,
        debtorMemberId: mKabir.id,
        creditorMemberId: mRohan.id,
        amount: new Prisma.Decimal(500.0),
        notes: 'Split for Fiber Internet',
      },
    ],
  });

  // Expense 2: March Grocery Haul (₹3,000 - Paid by Amit, split equally ₹1,000 each)
  const exp2 = await prisma.expense.create({
    data: {
      homeId: bachelorHome.id,
      payerMemberId: mAmit.id,
      amount: new Prisma.Decimal(3000.0),
      description: 'Monthly Grocery Haul',
      category: 'GROCERIES',
      splitType: 'EQUAL',
      date: new Date('2026-10-03T15:30:00Z'),
    },
  });

  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: exp2.id, memberId: mRohan.id, amount: new Prisma.Decimal(1000.0) },
      { expenseId: exp2.id, memberId: mAmit.id, amount: new Prisma.Decimal(1000.0) },
      { expenseId: exp2.id, memberId: mKabir.id, amount: new Prisma.Decimal(1000.0) },
    ],
  });

  await prisma.ledgerEntry.createMany({
    data: [
      {
        homeId: bachelorHome.id,
        expenseId: exp2.id,
        debtorMemberId: mRohan.id,
        creditorMemberId: mAmit.id,
        amount: new Prisma.Decimal(1000.0),
        notes: 'Split for Grocery Haul',
      },
      {
        homeId: bachelorHome.id,
        expenseId: exp2.id,
        debtorMemberId: mKabir.id,
        creditorMemberId: mAmit.id,
        amount: new Prisma.Decimal(1000.0),
        notes: 'Split for Grocery Haul',
      },
    ],
  });

  // 4. Seed Settlement: Amit settles ₹500 with Kabir
  const settlement1 = await prisma.settlement.create({
    data: {
      homeId: bachelorHome.id,
      fromMemberId: mAmit.id,
      toMemberId: mKabir.id,
      amount: new Prisma.Decimal(500.0),
      notes: 'UPI Ref #918237461',
      status: 'CONFIRMED',
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      homeId: bachelorHome.id,
      settlementId: settlement1.id,
      debtorMemberId: mKabir.id,
      creditorMemberId: mAmit.id,
      amount: new Prisma.Decimal(500.0),
      notes: 'Settlement from Amit to Kabir',
    },
  });

  // 5. Seed Family Home: "The Sharma Family"
  console.log('[SEED] Creating Family Home (The Sharma Family)...');
  const familyHome = await prisma.home.create({
    data: {
      name: 'The Sharma Family',
      type: 'FAMILY',
      currency: 'INR',
      description: 'Household budget and pooled expenditures',
    },
  });

  const fRohan = await prisma.homeMember.create({
    data: { homeId: familyHome.id, userId: rohan.id, role: 'OWNER' },
  });

  const fPriya = await prisma.homeMember.create({
    data: { homeId: familyHome.id, userId: priya.id, role: 'ADMIN' },
  });

  // Family Expense: Electricity & Water
  const fExp1 = await prisma.expense.create({
    data: {
      homeId: familyHome.id,
      payerMemberId: fRohan.id,
      amount: new Prisma.Decimal(4200.0),
      description: 'Electricity & Water Bill',
      category: 'UTILITIES',
      splitType: 'EQUAL',
      date: new Date('2026-10-02T12:00:00Z'),
    },
  });

  await prisma.expenseSplit.createMany({
    data: [
      { expenseId: fExp1.id, memberId: fRohan.id, amount: new Prisma.Decimal(2100.0) },
      { expenseId: fExp1.id, memberId: fPriya.id, amount: new Prisma.Decimal(2100.0) },
    ],
  });

  await prisma.ledgerEntry.create({
    data: {
      homeId: familyHome.id,
      expenseId: fExp1.id,
      debtorMemberId: fPriya.id,
      creditorMemberId: fRohan.id,
      amount: new Prisma.Decimal(2100.0),
      notes: 'Split for Electricity Bill',
    },
  });

  console.log('[SEED] Seed completed successfully!');
  console.log('Credentials for all seed users:');
  console.log('  - Email: rohan@example.com / Password: Password123!');
  console.log('  - Email: amit@example.com  / Password: Password123!');
  console.log('  - Email: kabir@example.com / Password: Password123!');
  console.log('  - Email: priya@example.com / Password: Password123!');
}

main()
  .catch((e) => {
    console.error('[SEED] Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
