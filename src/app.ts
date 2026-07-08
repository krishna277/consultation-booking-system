import 'dotenv/config';
import express from 'express';
import { BookingController } from './controllers/bookingController';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Main entry point endpoint for our booking requests
app.post('/api/bookings', BookingController.createBooking);

// Endpoint to fetch available slots
app.get('/api/slots/available', BookingController.listAvailableSlots);

// Endpoint to cancel a booking by passing its ID in the URL parameter
app.patch('/api/bookings/:id/status', BookingController.changeBookingStatus);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running perfectly via app.ts' });
});

app.listen(PORT, () => {
  console.log(`🚀 Consultation server actively listening on port http://localhost:${PORT}`);
});
