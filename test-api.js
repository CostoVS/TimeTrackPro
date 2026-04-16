import http from 'http';

http.get('http://localhost:3000/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Health:', res.statusCode, data));
}).on('error', (err) => console.error('Error:', err.message));

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
  res.on('end', () => console.log('Login:', res.statusCode, data));
});
req.on('error', (err) => console.error('Error:', err.message));
req.write(postData);
req.end();
