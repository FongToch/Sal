const express = require('express');
const path = require('path');
require('dotenv').config();

// ហៅទាញយកផ្លូវ Routes ដែលបានបំបែក
const gameRoutes = require('./routes/gameRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 🔌 ភ្ជាប់ Routes ចូលទៅកាន់ App (រាល់ Endpoint ទាំងអស់នឹងផ្តើមដោយ /api/...)
app.use('/api', gameRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
