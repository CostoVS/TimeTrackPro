import http from 'http';

const postData = JSON.stringify({ username: 'admin', password: '123' });
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Prod Login:', res.statusCode, data));
});
req.on('error', (err) => console.error('Error:', err.message));
req.write(postData);
req.end();
