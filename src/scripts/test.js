import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

// Test function to check error handling
async function testTrainErrors() {
  console.log('🧪 Testing Train API Error Handling...\n');

  try {
    // Test 1: Missing required parameters
    console.log('Test 1: Missing source parameter');
    const response1 = await axios.get(`${BASE_URL}/train/direct?destination=Mumbai&date=2026-04-07`);
    console.log('Response:', response1.data);
  } catch (error) {
    console.log('✅ Expected error caught:');
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log();
  }

  try {
    // Test 2: Invalid date format
    console.log('Test 2: Invalid date format');
    const response2 = await axios.get(`${BASE_URL}/train/direct?source=NDLS&destination=Mumbai&date=invalid-date`);
    console.log('Response:', response2.data);
  } catch (error) {
    console.log('✅ Expected error caught:');
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log();
  }

  try {
    // Test 3: Valid request to see if API works
    console.log('Test 3: Valid request');
    const response3 = await axios.get(`${BASE_URL}/train/direct?source=NDLS&destination=BOM&date=2026-04-07`);
    console.log('✅ Success response:');
    console.log('Status:', response3.status);
    console.log('Data keys:', Object.keys(response3.data));
    console.log();
  } catch (error) {
    console.log('❌ Unexpected error:');
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log();
  }

  try {
    // Test 5: Test with invalid station codes to trigger API errors
    console.log('Test 5: Invalid station codes (should trigger API error)');
    const response5 = await axios.get(`${BASE_URL}/train/direct?source=INVALID&destination=FAKE&date=2026-04-07`);
    console.log('Response:', response5.data);
  } catch (error) {
    console.log('✅ API Error caught:');
    console.log('Status:', error.response?.status);
    console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    console.log();
  }
}

// Run the tests
testTrainErrors().then(() => {
  console.log('🎉 Error handling tests completed!');
}).catch((err) => {
  console.error('❌ Test script error:', err.message);
});