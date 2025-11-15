// Modules
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

require('dotenv').config();

// Routes
const authRouter = require('./routes/authRoutes.js');
const userRouter = require('./routes/userRoutes.js');
const questionRouter = require('./routes/questionRoutes.js');
const formRouter = require('./routes/formRoutes.js');
const responseRouter = require('./routes/responseRoutes.js');

// Middlewares

// Configurations
const port = process.env.PORT;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Attach routes
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/questions", questionRouter);
app.use("/api/forms", formRouter);
app.use("/api/responses", responseRouter);

// Conect to MongoDB
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

const mongoURI = `mongodb+srv://${DB_USER}:${DB_PASSWORD}@cluster0.7icwgkf.mongodb.net/${DB_NAME}`;

async function connectDB() {
    try {
        await mongoose.connect(mongoURI, {
            retryWrites: true,
            w: 'majority'
        });
        console.log('Conectado ao MongoDB Atlas');
    } catch (error) {
        console.error('ERRO ao conectar ao MongoDB:');
        
        process.exit(1);
    }
}
connectDB();

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});