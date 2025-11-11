const jwt = require('jsonwebtoken');

require('dotenv').config();

// Middleware to validate token
const checkToken = (req, res, next) => {
    
    const token = req.header("auth-token");

    if (!token) {
        return res.status(401).json({ error: "Acesso negado! Token não fornecido." });
    }

    try {

        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();


    } catch (error) {
        return res.status(400).json({ error: "Token inválido!" });
    }

};

module.exports = checkToken;