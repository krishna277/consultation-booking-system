import { Request, Response } from 'express';
import { BookingService } from '../repositories/bookingRespository';
import { BookingStatus } from '@prisma/client';

export class BookingController {
  
  /**
   * POST /api/bookings
   * Creates a new booking using Optimistic Concurrency Control (OCC)
   */
  static async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const { slotId, patientId } = req.body;

      if (!slotId || !patientId) {
        res.status(400).json({ error: 'Missing mandatory slotId or patientId parameter.' });
        return;
      }

      const isSuccess = await BookingService.bookSlot(Number(slotId), String(patientId));

      if (isSuccess) {
        res.status(201).json({ message: 'Booking initialized and confirmed successfully!' });
      } else {
        res.status(409).json({ 
          error: 'Concurrency Conflict: Slot is no longer available. Please select another timing.' 
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error.' });
    }
  }

  /**
   * GET /api/slots/available
   * Fetches all unbooked slots sorted chronologically
   */
  static async listAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const slots = await BookingService.getAvailableSlots();
      res.status(200).json({ slots });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Internal server error.' });
    }
  }

  /**
   * PATCH /api/bookings/:id/status
   * NEW/UPDATED: Manages the explicit State Machine transitions for a booking's lifecycle
   */
  static async changeBookingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body; // Expects: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

      // 1. Parameter Validation
      if (!id || !status) {
        res.status(400).json({ error: 'Missing booking ID or next target status parameter.' });
        return;
      }

      // 2. Type Validation: Ensure the requested status matches our strict Prisma definitions
      if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
        res.status(400).json({ 
          error: `Invalid status code provided. Must be one of: ${Object.values(BookingStatus).join(', ')}` 
        });
        return;
      }

      // 3. Process State Machine Transition
      const isSuccess = await BookingService.updateBookingStatus(Number(id), status as BookingStatus);

      if (isSuccess) {
        res.status(200).json({ 
          message: `Booking state machine successfully updated to status: ${status}` 
        });
      } else {
        res.status(400).json({ 
          error: 'Transaction failed. Check server logs for state machine validation conflicts.' 
        });
      }
    } catch (error: any) {
      // Catches your service layer's "Illegal state transition" error and maps it to a clear 400 Bad Request
      res.status(400).json({ error: error.message || 'Internal state machine error.' });
    }
  }
}
