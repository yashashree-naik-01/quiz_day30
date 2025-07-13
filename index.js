// server/index.js (Complete, corrected, and improved)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { MongoClient, ObjectId } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

// =============================
// Middleware
// =============================
app.use(cors());
app.use(bodyParser.json());

// =============================
// MySQL Configuration
// =============================
const mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
});

// =============================
// MongoDB Configuration
// =============================
const mongoClient = new MongoClient(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

let mongoDB;

async function connectMongo() {
    try {
        await mongoClient.connect();
        mongoDB = mongoClient.db(process.env.MONGO_DB_NAME);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err);
        process.exit(1);
    }
}

connectMongo();

// Middleware to ensure MongoDB is ready
app.use((req, res, next) => {
    if (!mongoDB) {
        return res.status(503).json({ error: 'MongoDB not connected yet, please try again shortly.' });
    }
    next();
});

// =============================
// Routes for Questions (MongoDB)
// =============================
app.get('/api/questions', async (req, res) => {
    try {
        const questions = await mongoDB.collection('questions').find({}).toArray();
        res.json(questions);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch questions' });
    }
});

app.post('/api/questions', async (req, res) => {
    const { question, options, correctOption } = req.body;
    if (!question || !options || !correctOption) {
        return res.status(400).json({ error: 'Invalid question data' });
    }
    try {
        const result = await mongoDB.collection('questions').insertOne({
            question,
            options,
            correctOption,
        });
        res.json({ message: 'Question added', id: result.insertedId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to add question' });
    }
});

app.put('/api/questions/:id', async (req, res) => {
    const { id } = req.params;
    const { question, options, correctOption } = req.body;
    if (!question || !options || !correctOption) {
        return res.status(400).json({ error: 'Invalid update data' });
    }
    try {
        await mongoDB.collection('questions').updateOne(
            { _id: new ObjectId(id) },
            { $set: { question, options, correctOption } }
        );
        res.json({ message: 'Question updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to update question' });
    }
});

app.delete('/api/questions/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await mongoDB.collection('questions').deleteOne({ _id: new ObjectId(id) });
        res.json({ message: 'Question deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete question' });
    }
});

// =============================
// Routes for Student Scores (MySQL)
// =============================
app.post('/api/submit', (req, res) => {
    const { email, name, score } = req.body;
    if (!email || !name || typeof score !== 'number') {
        return res.status(400).json({ error: 'Invalid data' });
    }
    mysqlPool.query(
        'INSERT INTO studentscores (email, name, score) VALUES (?, ?, ?)',
        [email, name, score],
        (err, results) => {
            if (err) {
                console.error('❌ MySQL Error:', err);
                return res.status(500).json({ error: 'Failed to save score' });
            }
            res.json({ message: 'Score submitted' });
        }
    );
});

app.get('/api/scores', (req, res) => {
    const sql = "SELECT * FROM studentscores ORDER BY submitted_at DESC";
    mysqlPool.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database error' });
        }
        res.json(results);
    });
});

// =============================
// Health Check
// =============================
app.get('/', (req, res) => {
    res.send('✅ Quiz App Server is running');
});

// =============================
// Start Server
// =============================
app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
});
