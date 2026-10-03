const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const parkingSlots = [
  { slotId: 'A01', type: 'car', status: 'available', pricePerHour: 40 },
  { slotId: 'A02', type: 'car', status: 'occupied', pricePerHour: 40 },
  { slotId: 'A03', type: 'car', status: 'available', pricePerHour: 40 },
  { slotId: 'A04', type: 'car', status: 'available', pricePerHour: 40 },
  { slotId: 'B01', type: 'car', status: 'available', pricePerHour: 45 },
  { slotId: 'B02', type: 'car', status: 'occupied', pricePerHour: 45 },
  { slotId: 'B03', type: 'car', status: 'available', pricePerHour: 45 },
  { slotId: 'B04', type: 'ev', status: 'available', pricePerHour: 60 },
  { slotId: 'C01', type: 'accessible', status: 'available', pricePerHour: 35 },
  { slotId: 'C02', type: 'car', status: 'available', pricePerHour: 40 },
  { slotId: 'C03', type: 'car', status: 'occupied', pricePerHour: 40 },
  { slotId: 'C04', type: 'car', status: 'available', pricePerHour: 40 }
];

const bookings = [
  {
    bookingId: 'BK-1001',
    userName: 'Kaviya',
    vehicleNumber: 'TN 38 AB 1234',
    slotId: 'A02',
    vehicleType: 'car',
    durationHours: 2,
    startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    status: 'checked_in',
    totalPrice: 80,
    createdAt: new Date().toISOString()
  }
];

function generateBookingId() {
  const number = String(bookings.length + 1001);
  return `BK-${number}`;
}

function findSlot(slotId) {
  return parkingSlots.find((slot) => slot.slotId.toUpperCase() === String(slotId).toUpperCase());
}

function calculateTimeWindow(durationHours) {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
  return { startTime, endTime };
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ParkPilot booking backend is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/slots', (req, res) => {
  res.json({
    totalSlots: parkingSlots.length,
    slots: parkingSlots
  });
});

app.get('/api/slots/:slotId', (req, res) => {
  const slot = findSlot(req.params.slotId);

  if (!slot) {
    return res.status(404).json({ message: 'Parking slot not found' });
  }

  return res.json({ slot });
});

app.get('/api/bookings', (req, res) => {
  res.json({ total: bookings.length, bookings });
});

app.get('/api/bookings/:bookingId', (req, res) => {
  const booking = bookings.find((item) => item.bookingId === req.params.bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  return res.json({ booking });
});

app.post('/api/bookings', (req, res) => {
  const {
    userName,
    vehicleNumber,
    slotId,
    vehicleType = 'car',
    durationHours = 1,
    userId = 'guest'
  } = req.body;

  if (!userName || !vehicleNumber || !slotId) {
    return res.status(400).json({
      message: 'userName, vehicleNumber and slotId are required'
    });
  }

  const slot = findSlot(slotId);

  if (!slot) {
    return res.status(404).json({ message: 'Selected parking slot does not exist' });
  }

  if (slot.status === 'occupied' || slot.status === 'reserved') {
    return res.status(409).json({
      message: 'Selected slot is not available for booking'
    });
  }

  const { startTime, endTime } = calculateTimeWindow(Number(durationHours) || 1);
  const totalPrice = Number(durationHours || 1) * slot.pricePerHour;

  const booking = {
    bookingId: generateBookingId(),
    userName,
    userId,
    vehicleNumber,
    slotId: slot.slotId,
    vehicleType,
    durationHours: Number(durationHours) || 1,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    status: 'confirmed',
    totalPrice,
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);
  slot.status = 'reserved';

  return res.status(201).json({
    message: 'Booking created successfully',
    booking
  });
});

app.put('/api/bookings/:bookingId/extend', (req, res) => {
  const { extraHours = 1 } = req.body;
  const booking = bookings.find((item) => item.bookingId === req.params.bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  const hours = Number(extraHours) || 1;
  const oldEndTime = new Date(booking.endTime);
  const newEndTime = new Date(oldEndTime.getTime() + hours * 60 * 60 * 1000);

  booking.durationHours += hours;
  booking.endTime = newEndTime.toISOString();
  booking.totalPrice += hours * findSlot(booking.slotId).pricePerHour;

  return res.json({
    message: 'Booking extended successfully',
    booking
  });
});

app.put('/api/bookings/:bookingId/check-in', (req, res) => {
  const booking = bookings.find((item) => item.bookingId === req.params.bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  booking.status = 'checked_in';

  const slot = findSlot(booking.slotId);
  if (slot) slot.status = 'reserved';

  return res.json({
    message: 'Vehicle checked in successfully',
    booking
  });
});

app.put('/api/bookings/:bookingId/cancel', (req, res) => {
  const bookingIndex = bookings.findIndex((item) => item.bookingId === req.params.bookingId);

  if (bookingIndex === -1) {
    return res.status(404).json({ message: 'Booking not found' });
  }

  const booking = bookings[bookingIndex];
  const slot = findSlot(booking.slotId);

  if (slot) {
    slot.status = 'available';
  }

  bookings.splice(bookingIndex, 1);

  return res.json({
    message: 'Booking cancelled successfully',
    bookingId: booking.bookingId
  });
});

app.get('/api/reports/billing', (req, res) => {
  const requestedDays = req.query.days;
  const days = requestedDays === 'all' ? 0 : Number(requestedDays || 30);

  if (days !== 0 && ![7, 30, 90].includes(days)) {
    return res.status(400).json({ message: 'days must be 7, 30, 90 or all' });
  }

  const cutoff = days === 0 ? null : Date.now() - days * 24 * 60 * 60 * 1000;
  const reportBookings = bookings
    .filter((booking) => !cutoff || new Date(booking.createdAt).getTime() >= cutoff)
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  const dailyTotals = new Map();

  for (const booking of reportBookings) {
    const date = new Date(booking.createdAt).toISOString().slice(0, 10);
    const total = Number(booking.totalPrice) || 0;
    dailyTotals.set(date, (dailyTotals.get(date) || 0) + total);
  }

  const totalBookingValue = reportBookings.reduce(
    (total, booking) => total + (Number(booking.totalPrice) || 0),
    0
  );

  return res.json({
    days: days || 'all',
    bookingCount: reportBookings.length,
    totalBookingValue,
    averageBookingValue: reportBookings.length ? totalBookingValue / reportBookings.length : 0,
    daily: Array.from(dailyTotals, ([date, bookingValue]) => ({ date, bookingValue }))
      .sort((first, second) => first.date.localeCompare(second.date)),
    bookings: reportBookings
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ParkPilot backend running at http://localhost:${PORT}`);
});
