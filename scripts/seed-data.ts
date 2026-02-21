import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, closeDatabase } from '../src/shared/config/database';
import { Seat } from '../src/shared/models/seat.model';

const seedSeats = async () => {
  console.log('🌱 Seeding seats for flight SK123...');

  const seats = [];
  const rows = 30;
  const columns = ['A', 'B', 'C', 'D', 'E', 'F'];

  for (let row = 1; row <= rows; row++) {
    for (const col of columns) {
      const seatType =
        col === 'A' || col === 'F' ? 'WINDOW' : col === 'C' || col === 'D' ? 'AISLE' : 'MIDDLE';

      // Premium seats (rows 1-5) cost $50, standard seats cost $25
      const price = row <= 5 ? 50 : 25;

      seats.push({
        seatId: `${row}${col}`,
        flightId: 'SK123',
        rowNumber: row,
        columnLetter: col,
        seatType,
        state: 'AVAILABLE',
        price,
      });
    }
  }

  // Clear existing seats for SK123
  const deleted = await Seat.deleteMany({ flightId: 'SK123' });
  if (deleted.deletedCount > 0) {
    console.log(`🗑️  Cleared ${deleted.deletedCount} existing seats`);
  }

  // Insert new seats
  await Seat.insertMany(seats);

  console.log(`✅ Seeded ${seats.length} seats for flight SK123`);
  console.log(`   - Rows: 1-${rows}`);
  console.log(`   - Columns: ${columns.join(', ')}`);
  console.log(`   - Premium (rows 1-5): $50`);
  console.log(`   - Standard (rows 6-${rows}): $25`);
  console.log(`   - Window: ${seats.filter((s) => s.seatType === 'WINDOW').length}`);
  console.log(`   - Aisle: ${seats.filter((s) => s.seatType === 'AISLE').length}`);
  console.log(`   - Middle: ${seats.filter((s) => s.seatType === 'MIDDLE').length}`);
};

const main = async () => {
  try {
    console.log('📦 Starting database seeding...\n');
    await connectDatabase();
    await seedSeats();
    console.log('\n✅ Database seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
};

main();
