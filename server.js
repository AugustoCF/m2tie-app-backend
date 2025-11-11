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

// Middlewares

// Configurations
const dbName = process.env.DB_NAME;
const port = process.env.PORT;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Attach routes
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/question", questionRouter)

// Conect to MongoDB
mongoose.connect(
    `mongodb://localhost/${dbName}`
);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});