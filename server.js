const express = require('express');
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
    res.send(`Hello World ${new Date().toISOString()}`);
});

app.get('/api/v1/hello', (req, res) => {
    res.send('Good Afternoon');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});