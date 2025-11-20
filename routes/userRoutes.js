const router = require('express').Router();
const bcrypt = require('bcrypt');

const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');

/**
 * @swagger
 * /api/users/all:
 *   get:
 *     summary: Listar todos os usuários
 *     description: Retorna todos os usuários cadastrados no sistema (apenas admin)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuários encontrados com sucesso
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
 *                   example: "Usuários encontrados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Usuário não encontrado"
 *       500:
 *         description: Erro ao buscar usuários
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Erro ao buscar usuários"
 */
// Get all users - ADMIN ONLY
router.get("/all", verifyToken, async (req, res) => {
    
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {

        // Verify ADMIN role
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado" });
        }

        // Get all users
        const users = await User.find({ deleted: false }, {  password: 0 });

        return res.json({ error: null, msg: "Usuários encontrados com sucesso", data: users });
        
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

/**
 * @swagger
 * /api/users/assignable:
 *   get:
 *     summary: Listar usuários atribuíveis a formulários
 *     description: Retorna apenas estudantes e professores que podem responder formulários (apenas admin)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuários encontrados com sucesso
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
 *                   example: "Usuários encontrados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *             example:
 *               error: null
 *               msg: "Usuários encontrados com sucesso"
 *               data:
 *                 - _id: "507f1f77bcf86cd799439011"
 *                   name: "Maria Santos"
 *                   email: "maria@email.com"
 *                   role: "student"
 *                   city: "Rio de Janeiro"
 *                   state: "RJ"
 *                   institution: "Escola ABC"
 *                 - _id: "507f1f77bcf86cd799439012"
 *                   name: "Pedro Oliveira"
 *                   email: "pedro@email.com"
 *                   role: "teacher_respondent"
 *                   city: "Belo Horizonte"
 *                   state: "MG"
 *                   institution: "Colégio XYZ"
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado"
 *       404:
 *         description: Usuário autenticado não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Usuário não encontrado"
 *       500:
 *         description: Erro ao buscar usuários
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Erro ao buscar usuários"
 */
// Get all students and teacher respondents - for form assignment - ADMIN ONLY 
router.get("/assignable", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {

        // Verify ADMIN role
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado" });
        }

        // Get all users
        const users = await User.find({ deleted: false, role: { $in: ['student', 'teacher_respondent'] } }, {  password: 0 });

        return res.json({ error: null, msg: "Usuários encontrados com sucesso", data: users });
        
    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar usuários" });
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Obter usuário por ID
 *     description: Retorna informações de um usuário específico (sem senha)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID do usuário
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Usuário encontrado com sucesso
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
 *                   example: "Usuário encontrado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Usuário não encontrado"
 */
// Get an user
router.get("/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const id = req.params.id;

    try {
        // Verify if requester user exists
        const requesterUser = await User.findOne({ _id: userId, deleted: false });
        if (!requesterUser) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Verify if user exists
        const user = await User.findOne({ _id: id, deleted: false }, {  password: 0 });

        res.json({ error: null, msg: "Usuário encontrado com sucesso", data: user });

    } catch (error) {
        return res.status(404).json({ error: "Usuário não encontrado" });
    }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Atualizar usuário
 *     description: |
 *       Atualiza dados de um usuário. 
 *       - Usuários podem editar seus próprios dados (exceto role)
 *       - Admin pode editar qualquer usuário e alterar roles
 *       - Todos os campos são opcionais
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID do usuário a ser atualizado
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "João Silva Atualizado"
 *               anonymous:
 *                 type: boolean
 *                 example: true
 *                 description: "Se o usuário deseja permanecer anônimo"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao.novo@email.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: "novaSenha123"
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 example: "novaSenha123"
 *                 description: "Deve ser igual ao campo password"
 *               role:
 *                 type: string
 *                 enum: [admin, student, teacher_analyst, teacher_respondent]
 *                 example: "teacher_analyst"
 *                 description: "Apenas admin pode alterar role"
 *               city:
 *                 type: string
 *                 example: "São Paulo"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               institution:
 *                 type: string
 *                 example: "Universidade Federal"
 *           examples:
 *             atualizarNome:
 *               summary: Atualizar apenas nome
 *               value:
 *                 name: "João Silva Atualizado"
 *             atualizarAnonimato:
 *               summary: Tornar usuário anônimo
 *               value:
 *                 anonymous: true
 *             atualizarSenha:
 *               summary: Atualizar senha
 *               value:
 *                 password: "novaSenha123"
 *                 confirmPassword: "novaSenha123"
 *             atualizarRole:
 *               summary: Atualizar role (apenas admin)
 *               value:
 *                 role: "teacher_analyst"
 *             atualizarLocalizacao:
 *               summary: Atualizar localização
 *               value:
 *                 city: "Rio de Janeiro"
 *                 state: "RJ"
 *                 institution: "UFRJ"
 *             atualizarCompleto:
 *               summary: Atualização completa
 *               value:
 *                 name: "João Silva"
 *                 anonymous: false
 *                 email: "joao.novo@email.com"
 *                 password: "novaSenha123"
 *                 confirmPassword: "novaSenha123"
 *                 role: "teacher_analyst"
 *                 city: "São Paulo"
 *                 state: "SP"
 *                 institution: "USP"
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
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
 *                   example: "Usuário atualizado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               emailJaCadastrado:
 *                 value:
 *                   error: "Email já cadastrado"
 *               senhasNaoCoincidem:
 *                 value:
 *                   error: "As senhas não coincidem"
 *               funcaoInvalida:
 *                 value:
 *                   error: "Função inválida."
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               acessoNegado:
 *                 value:
 *                   error: "Acesso negado"
 *               apenasAdmin:
 *                 value:
 *                   error: "Acesso negado. Apenas administradores podem alterar funções."
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Usuário não encontrado"
 *       500:
 *         description: Erro ao atualizar usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Erro ao atualizar usuário"
 */
// Update an user
router.put("/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();
    
    // Request data
    const userReqId = req.params.id;
    const name = req.body.name;
    const anonymous = req.body.anonymous;
    const email = req.body.email;
    const password = req.body.password;
    const confirmpassword = req.body.confirmPassword;
    const userReqrole = req.body.role;
    const city = req.body.city;
    const state = req.body.state;
    const institution = req.body.institution;

    try {

        // Check if user exists in DB
        const user = await User.findOne({ _id: userId, deleted: false });

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

        if (typeof anonymous !== "undefined") {
            updateData.anonymous = anonymous;
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

            const validRoles = ['admin', 'student', 'teacher_analyst', 'teacher_respondent'];

            if (!validRoles.includes(userReqrole)) {
                return res.status(400).json({ error: "Função inválida. " });
            }

            // Check if user is admin
            if (role !== 'admin') {
                return res.status(401).json({ error: "Acesso negado. Apenas administradores podem alterar funções." });
            }

            updateData.role = userReqrole;
        }

        // Check other fields

        if (city) {
            updateData.city = city;
        }

        if (state) {
            updateData.state = state;
        }

        if (institution) {
            updateData.institution = institution;
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

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Deletar usuário
 *     description: Remove um usuário do sistema através de soft delete (apenas admin)
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: ID do usuário a ser deletado
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Usuário deletado com sucesso
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
 *                   example: "Usuário deletado com sucesso"
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores podem deletar usuários."
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Usuário não encontrado"
 *       500:
 *         description: Erro ao deletar usuário
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Erro ao deletar usuário"
 */
// Delete an user by ID - ADMIN ONLY
router.delete("/:id", verifyToken, async (req, res) => {
    const id = req.params.id;
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {

        // Check ADMIN role
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem deletar usuários." });
        }

        // Soft delete: set deleted flag to true
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: { deleted: true } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Usuário deletado com sucesso" });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao deletar usuário" });  
    }
});

module.exports = router;