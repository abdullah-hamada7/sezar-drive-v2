const http = require('http');

const options = {
  hostname: 'localhost',
  port: 80, // Test Nginx port
  path: '/uploads/inspections/08e2ae47-69e3-4659-ac64-8cf9f56fbd45.png', // Re-use the filename we found
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
