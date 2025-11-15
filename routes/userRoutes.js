const router = require('express').Router();
const bcrypt = require('bcrypt');

const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');

// Get all users
router.get("/all", verifyToken, async (req, res) => {
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {

        // Verify ADMIN role
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado" });
        }

        // Get all users
        const users = await User.find({}, {  password: 0 });

        res.json({ error: null, msg: "Usuários encontrados com sucesso", data: users });
        
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

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
router.put("/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();
    
    // Request data
    const userReqId = req.params.id;
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const confirmpassword = req.body.confirmPassword;
    const userReqrole = req.body.role;

    try {

        // Check if user exists in DB
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;

        // Check if ReqId is valid
        const userReq = await User.findOne({ _id: userReqId });

        if (!userReq) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Check role ADMIN or same user
        if (role !== 'admin' && userId !== userReqId) {
            return res.status(401).json({ error: "Acesso negado" });
        }

        // Create an object user
        const updateData = {};

        // Check body content
        if (name) {  
            updateData.name = name;
        }

        if (email) {
            const emailExists = await User.findOne({ email: email, _id: { $ne: userReqId } });
            if (emailExists) {
                return res.status(400).json({ error: "Email já cadastrado" });
            }
            updateData.email = email;
        }

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
        if (userReqrole) {  

            const validRoles = ['user', 'admin', 'staff'];

            if (!validRoles.includes(userReqrole)) {
                return res.status(400).json({ error: "Função inválida. " });
            }

            // Check if user is admin
            if (role !== 'admin') {
                return res.status(401).json({ error: "Acesso negado. Apenas administradores podem alterar funções." });
            }

            updateData.role = userReqrole;
        }

        // Returns updated data
        const updatedUser = await User.findOneAndUpdate(
            { _id: userReqId },
            { $set: updateData }, 
            { new: true }
        ).select('-password');

        res.json({ error: null, msg: "Usuário atualizado com sucesso", data: updatedUser });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao atualizar usuário" });
    }
});

// Delete an user by ID
router.delete("/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {

        // Check ADMIN role
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem deletar usuários." });
        }

        // Verify if the user exists and delete
        const deletedUser = await User.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Usuário deletado com sucesso" });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao deletar usuário" });  
    }
});

module.exports = router;