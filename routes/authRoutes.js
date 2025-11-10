const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import User model
const User = require('../models/user');

// Register an User
router.post("/register", async (req, res) => {

    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const confirmpassword = req.body.confirmpassword;
    const role = req.body.role;

    // Check for required fields
    if (!name || !email || !password || !confirmpassword || !role) {
        return res.status(400).json({ message: "Por favor preencha todos os campos obrigatórios" });
    }

    // Check if passwords match
    if (password !== confirmpassword) {
        return res.status(400).json({ message: "As senhas não coincidem" });
    }

    // Check if role is valid
    const validRoles = ['admin', 'staff', 'user'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: "Função inválida" });
    }

    // Check if user already exists
    const emailExists = await User.findOne({ email: email });

    if (emailExists) {
        return res.status(400).json({ message: "O e-mail já está em uso" });
    }

    // Create password hash
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create a new user
    const user = new User({
        name: name,
        email,
        password: passwordHash,
        role
    });

    try {

        const newUser = await user.save();

        // Create user token
        const token = jwt.sign(
            {
                name: newUser.name,
                userId: newUser._id,
                role: newUser.role
            },
            process.env.JWT_SECRET
        );

        // Return token
        res.json({ error: null, msg: "Registro realizado com sucesso", token: token, userId: newUser._id });

    } catch (error) {
        res.status(500).json({ error });
    }

});


module.exports = router;