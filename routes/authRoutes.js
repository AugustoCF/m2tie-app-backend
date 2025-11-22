const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Import User model
const User = require('../models/user');
const { sendResetEmail } = require('../helpers/emailService');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     description: Cria uma nova conta de usuário no sistema
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegister'
 *           example:
 *             name: "João Silva"
 *             email: "joao@email.com"
 *             password: "senha123"
 *             confirmpassword: "senha123"
 *             role: "student"
 *     responses:
 *       200:
 *         description: Usuário registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 msg:
 *                   type: string
 *                   example: "Registro realizado com sucesso"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 userId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *               examples:
 *                 camposObrigatorios:
 *                   value:
 *                     error: "Por favor preencha todos os campos obrigatórios"
 *                 senhasNaoCoincidem:
 *                   value:
 *                     error: "As senhas não coincidem"
 *                 funcaoInvalida:
 *                   value:
 *                     error: "Função inválida"
 *                 emailEmUso:
 *                   value:
 *                     error: "O e-mail já está em uso"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 */
// Register an User
router.post("/register", async (req, res) => {

    const name = req.body.name;
    const anonymous = req.body.anonymous;
    const email = req.body.email;
    const password = req.body.password;
    const confirmpassword = req.body.confirmPassword;
    const role = req.body.role;
    const city = req.body.city;
    const state = req.body.state;
    const institution = req.body.institution;

    // Check for required fields
    if (!name || anonymous === undefined || !email || !password || !confirmpassword || !role || !city || !state || !institution) {
        return res.status(400).json({ error: "Por favor preencha todos os campos obrigatórios" });
    }

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Formato de e-mail inválido" });
    }

    // Check if passwords match
    if (password !== confirmpassword) {
        return res.status(400).json({ error: "As senhas não coincidem" });
    }

    // Check if role is valid
    const validRoles = ['admin', 'student', 'teacher_analyst', 'teacher_respondent'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Função inválida" });
    }

    // Check if user already exists
    const emailExists = await User.findOne({ email: email });

    if (emailExists) {
        return res.status(400).json({ error: "O e-mail já está em uso" });
    }

    // Create password hash
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create a new user
    const user = new User({
        name: name,
        anonymous: anonymous,
        email: email,
        password: passwordHash,
        role: role,
        city: city,
        state: state,
        institution: institution
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

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login de usuário
 *     description: Autentica um usuário e retorna um token JWT
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *           example:
 *             email: "joao@email.com"
 *             password: "senha123"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 msg:
 *                   type: string
 *                   example: "Você está autenticado"
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 userId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *       400:
 *         description: Erro de autenticação
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *               examples:
 *                 camposObrigatorios:
 *                   value:
 *                     error: "Por favor preencha todos os campos obrigatórios"
 *                 usuarioNaoEncontrado:
 *                   value:
 *                     error: "Não há um usuário cadastrado com este e-mail"
 *                 senhaInvalida:
 *                   value:
 *                     error: "Senha inválida"
 */
// Login an User
router.post("/login", async (req, res) => {

    const email = req.body.email;
    const password = req.body.password;

    // Check for required fields
    if (!email || !password) {
        return res.status(400).json({ error: "Por favor preencha todos os campos obrigatórios" });
    }

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Formato de e-mail inválido" });
    }

    try {

        // Check if user exists
        const user = await User.findOne({ email: email });

        if (!user) {
            return res.status(400).json({ error: "Não há um usuário cadastrado com este e-mail" });
        }

        // Check if password matches
        const checkPassword = await bcrypt.compare(password, user.password);

        if (!checkPassword) {
            return res.status(400).json({ error: "Senha inválida" });
        }

        // Create user token
        const token = jwt.sign(
            {
                name: user.name,
                userId: user._id,
                role: user.role
            },
            process.env.JWT_SECRET 
        );

        // Return token
        res.json({ error: null, msg: "Você está autenticado", token: token, userId: user._id });

    } catch (error) {
        return res.status(500).json({ error }); 
    }
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar reset de senha
 *     description: Envia email com link para redefinir senha
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "joao@email.com"
 *     responses:
 *       200:
 *         description: Email enviado com sucesso
 *       400:
 *         description: Email não fornecido
 *       500:
 *         description: Erro ao processar solicitação
 */
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        // Email Validation
        if (!email) {
            return res.status(400).json({ error: "Por favor forneça o e-mail" });
        }

        // Check email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Formato de e-mail inválido" });
        }

        // Search for user
        const user = await User.findOne({ email });

        // For security, always return success (do not reveal if email exists)
        if (!user) {
            return res.status(200).json({ 
                error: null,
                msg: "Se o e-mail existir, você receberá um link para redefinir a senha" 
            });
        }

        // Generate random token
        const token = crypto.randomBytes(32).toString('hex');

        // Hash the token before saving
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Save token and expiration date (1 hour)
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();

        // Send email with ORIGINAL token (not the hash)
        await sendResetEmail(email, token);

        res.status(200).json({ 
            error: null,
            msg: "E-mail de recuperação enviado com sucesso" 
        });

    } catch (error) {
        console.error('Erro em forgot-password:', error);
        res.status(500).json({ error: "Erro ao processar solicitação" });
    }
});

/**
 * @swagger
 * /api/auth/reset-password/{token}:
 *   post:
 *     summary: Redefinir senha
 *     description: Redefine a senha do usuário usando o token recebido por email
 *     tags: [Autenticação]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: "novaSenha123"
 *               confirmPassword:
 *                 type: string
 *                 example: "novaSenha123"
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Token inválido ou senhas não coincidem
 *       500:
 *         description: Erro ao redefinir senha
 */
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        // Validations
        if (!password || !confirmPassword) {
            return res.status(400).json({ error: "Por favor preencha todos os campos" });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: "As senhas não coincidem" });
        }

        // Hash the received token
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');

        // Search for user with valid and non-expired token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ 
                error: "Token inválido ou expirado. Solicite um novo link de recuperação" 
            });
        }

        // Criar hash da nova senha
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);

        // Atualizar senha e invalidar token
        user.password = passwordHash;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({ 
            error: null,
            msg: "Senha redefinida com sucesso. Você já pode fazer login" 
        });

    } catch (error) {
        console.error('Erro em reset-password:', error);
        res.status(500).json({ error: "Erro ao redefinir senha" });
    }
});


module.exports = router;