const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/user');

// Get user by token
const getUserByToken = async (token) => {

    if (!token) {
        return res.status(401).json({ error: "Acesso negado! Token não fornecido." });
    }

    // Find user by token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    const user = await User.findOne({ _id: userId }, { password: 0 });

    return user;
};

module.exports = getUserByToken;