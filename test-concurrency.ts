import axios from 'axios';

async function simulateRaceCondition() {
  console.log('🏁 Simulating 2 concurrent booking requests for Slot ID: 1...');

  const payload1 = { slotId: 1, patientId: 'patient_alice' };
  const payload2 = { slotId: 1, patientId: 'patient_bob' };

  // Fire both API requests at the exact same time using Promise.all
  const requests = [
    axios.post('http://localhost:3000/api/bookings', payload1).catch(err => err.response),
    axios.post('http://localhost:3000/api/bookings', payload2).catch(err => err.response)
  ];

  const [res1, res2] = await Promise.all(requests);

  console.log('\n--- Result for Request 1 (Alice) ---');
  console.log(`Status: ${res1.status}`);
  console.log(`Data:`, res1.data);

  console.log('\n--- Result for Request 2 (Bob) ---');
  console.log(`Status: ${res2.status}`);
  console.log(`Data:`, res2.data);
}

simulateRaceCondition();
