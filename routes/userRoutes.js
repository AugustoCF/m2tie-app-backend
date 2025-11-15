const router = require('express').Router();
const bcrypt = require('bcrypt');

const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');

// Get an user
router.get("/:id", verifyToken, async (req, res) => {

    const id = req.params.id;

    try {
        // Verify if user exists
        const user = await User.findOne({ _id: id }, {  password: 0 });

        res.json({ error: null, msg: "Usuário encontrado com sucesso", data: user });

    } catch (error) {
        return res.status(404).json({ error: "Usuário não encontrado" });
    }
});

// Update an user
router.put("/", verifyToken, async (req, res) => {

    const token = req.header("auth-token");
    const user = await getUserByToken(token);
    const userReqId = req.body.id;
    const password = req.body.password;
    const confirmpassword = req.body.confirmPassword;
    const role = req.body.role;

    const userId = user._id.toString();

    // Check if user id is equal token user id
    if (userId !== userReqId) {
        return res.status(401).json({ error: "Acesso negado" });
    }

    // Create an object user
    const updateData = {
        name: req.body.name,
        email: req.body.email
    };

    // Check if password match
    if (password) {  
        if (password !== confirmpassword) {
            return res.status(400).json({ error: "As senhas não coincidem" });
        }

        // Create password hash
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // Add password to updateData
        updateData.password = passwordHash;
    }

    // Check role
    if (role) {  

        const validRoles = ['user', 'admin', 'staff'];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: "Função inválida. " });
        }

        updateData.role = role;
    }

    try {
        
        // Returns updated data
        const updatedUser = await User.findOneAndUpdate({ _id: userId }, { $set: updateData }, { new: true });

        res.json({ error: null, msg: "Usuário atualizado com sucesso", data: updatedUser });

    } catch (error) {
        return res.status(400).json({ error });
    }

});

// Delete an user by ID
router.delete("/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const token = req.header("auth-token");
    const user = await getUserByToken(token);
    const userId = user._id.toString();

    try {

        // Check ADMIN role
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado" });
        }

        // Verify if the user exists and delete
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Usuário deletado com sucesso" });

    } catch (error) {
        return res.status(400).json({ error });
    }
});

module.exports = router;