import { PrismaClient, SlotStatus, BookingStatus } from '@prisma/client'; // <-- Add SlotStatus here
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export class BookingService {

  // State validator: Dictates exactly what transitions are valid
  private static isValidTransition(current: BookingStatus, next: BookingStatus): boolean {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
      [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED, BookingStatus.COMPLETED],
      [BookingStatus.CANCELLED]: [],   // Terminal state
      [BookingStatus.COMPLETED]: [],   // Terminal state
    };
    return validTransitions[current].includes(next);
  }

  // Fetch all available slots
  static async getAvailableSlots() {
    return await prisma.slot.findMany({
      where: {
        status: SlotStatus.AVAILABLE,
      },
      orderBy: {
        startTime: 'asc', // Sort by soonest slots first
      },
    });
  }

  // Enhanced booking logic: Validates initial slot states
  static async bookSlot(slotId: number, patientId: string): Promise<boolean> {
    // 1. Fetch the target slot
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
    });

    if (!slot || slot.status !== SlotStatus.AVAILABLE) {
      throw new Error('Slot is no longer available.');
    }

    try {
      // 2. Wrap the update and booking row in a transaction block
      return await prisma.$transaction(async (tx) => {
        
        // 3. ATOMIC VERIFICATION: Check the version matches what we read
        const updateResult = await tx.slot.updateMany({
          where: {
            id: slotId,
            version: slot.version,
            status: SlotStatus.AVAILABLE,
          },
          data: {
            status: SlotStatus.BOOKED,
            version: { increment: 1 }, 
          },
        });

        if (updateResult.count === 0) {
          throw new Error('Concurrency conflict: Slot was updated by another request.');
        }

        // 4. Create the booking record
        await tx.booking.create({
          data: {
            slotId: slotId,
            patientId: patientId,
            status: BookingStatus.CONFIRMED,
          },
        });

        return true;
      });
    } catch (error: any) {
      console.error('Booking execution failed:', error.message);
      return false;
    }
  }

  // Enhanced cancellation: Validates state bounds before changing row values
  static async updateBookingStatus(bookingId: number, nextStatus: BookingStatus): Promise<boolean> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { slot: true }
    });

    if (!booking) throw new Error('Booking record not found.');

    // STRICT BUSINESS RULE GUARD: Explicitly block illegal state transitions
    if (!this.isValidTransition(booking.status, nextStatus)) {
      throw new Error(`Illegal state transition from ${booking.status} to ${nextStatus}`);
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Apply status modification
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: nextStatus }
        });

        // If transitioning to CANCELLED, free up the underlying appointment slot
        if (nextStatus === BookingStatus.CANCELLED) {
          await tx.slot.update({
            where: { id: booking.slotId },
            data: {
              status: SlotStatus.AVAILABLE,
              version: { increment: 1 }
            }
          });
        }
        return true;
      });
    } catch (error: any) {
      console.error('State machine transition failed:', error.message);
      return false;
    }
  }
}
