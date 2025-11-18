const router = require('express').Router();

// Models
const Question = require('../models/question');
const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');
const { validateQuestion, validateQuestionUpdate } = require('../helpers/validate-question-fields');

/**
 * @swagger
 * /api/questions:
 *   post:
 *     summary: Criar nova questão
 *     description: Cria uma nova questão para ser utilizada em formulários (apenas admin)
 *     tags: [Questões]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionCreate'
 *           examples:
 *             textoSimples:
 *               summary: Questão de texto
 *               value:
 *                 title: "Qual o seu nome completo?"
 *                 type: "text"
 *                 validation:
 *                   required: true
 *                   minLength: 3
 *                   maxLength: 100
 *             multiplaEscolha:
 *               summary: Múltipla escolha
 *               value:
 *                 title: "Qual a sua faixa etária?"
 *                 type: "multiple_choice"
 *                 options:
 *                   - label: "18-25 anos"
 *                     value: "18_25"
 *                   - label: "26-35 anos"
 *                     value: "26_35"
 *                   - label: "36+ anos"
 *                     value: "36_plus"
 *                 validation:
 *                   required: true
 *             escala:
 *               summary: Escala de 1 a 10
 *               value:
 *                 title: "Nível de satisfação (1-10)"
 *                 type: "scale"
 *                 validation:
 *                   required: true
 *     responses:
 *       201:
 *         description: Questão criada com sucesso
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
 *                   example: "Questão criada com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Question'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               tituloObrigatorio:
 *                 value:
 *                   error: "O título é obrigatório"
 *               tipoInvalido:
 *                 value:
 *                   error: "Tipo de questão inválido"
 *               opcoesFaltando:
 *                 value:
 *                   error: "Questões do tipo multiple_choice, checkbox e dropdown requerem opções"
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores podem criar questões"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro ao criar a questão
 */
// Create new Question
router.post("/", verifyToken, async (req, res) => {
    
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const role = userByToken.role;
    const userId = userByToken._id.toString();

    // Request data
    const title = req.body.title;
    const type = req.body.type;
    const options = req.body.options;
    const validation = req.body.validation;

    // Only 'admin' can create questions
    if (role !== 'admin') {
        return res.status(401).json({ error: "Acesso negado, apenas administradores podem criar questões" });
    }

    // Validate question fields
    const validationResult = validateQuestion({ title, type, options, validation });
        
    if (!validationResult.isValid) {
        return res.status(400).json({ error: validationResult.error });
    }

    // Verify user
    try {

        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const question = new Question({
            title: title.trim(),
            type,
            options: options?.map(opt => ({
                label: opt.label.trim(),
                value: opt.value.trim()
            })) || [],
            validation: validation || { required: false },
            createdBy: user._id.toString()
        });

        try {

            const newQuestion = await question.save();
            return res.status(201).json({error: null, msg: "Questão criada com sucesso", data: newQuestion });

        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar a questão" });
        }

    } catch (error) {
        return res.status(400).json({ error: "Acesso Negado" });
    } 
});

/**
 * @swagger
 * /api/questions/all:
 *   get:
 *     summary: Listar todas as questões
 *     description: Retorna todas as questões cadastradas no sistema (apenas admin e staff)
 *     tags: [Questões]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Questões encontradas com sucesso
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
 *                   example: "Questões encontradas com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Question'
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores e equipe podem acessar as questões"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Get all Questions for staff and admin
router.get("/all", verifyToken, async (req, res) => {
    try {

        const token = req.header("auth-token");
        const userByToken = await getUserByToken(token);
        const userId = userByToken._id.toString();

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin' && user.role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar as questões" });
        }
        
        const questions = await Question.find({ deleted: false })
            .sort({ createdAt: -1 })
            .populate({
                path: 'createdBy',
                select: 'name email role city state institution',
                match: { deleted: false }
            });
            

        return res.status(200).json({ error: null, msg: "Questões encontradas com sucesso", data: questions });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/questions/{id}:
 *   get:
 *     summary: Obter questão por ID
 *     description: Retorna uma questão específica (apenas admin e staff)
 *     tags: [Questões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da questão
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Questão encontrada com sucesso
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
 *                   example: "Questão encontrada com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Question'
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Questão ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado"
 *               questaoNaoEncontrada:
 *                 value:
 *                   error: "Questão não encontrada"
 *       500:
 *         description: Erro interno do servidor
 */
// Get Question by ID
router.get("/:id", verifyToken, async (req, res) => {

    try {

        const token = req.header("auth-token");
        const userByToken = await getUserByToken(token);
        const userId = userByToken._id.toString();

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin' && user.role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar as questões" });
        }

        const questionId = req.params.id;

        const question = await Question.findOne({ _id: questionId, deleted: false })
            .populate({
                path: 'createdBy',
                select: 'name email role city state institution',
                match: { deleted: false }
            });

        if (!question) {
            return res.status(404).json({ error: "Questão não encontrada" });
        }

        return res.status(200).json({ error: null, msg: "Questão encontrada com sucesso", data: question });

    } catch (error) {
        return res.status(500).json({ error });
    }

});

/**
 * @swagger
 * /api/questions/{id}:
 *   delete:
 *     summary: Deletar questão
 *     description: Remove uma questão do sistema (apenas admin)
 *     tags: [Questões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da questão
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Questão deletada com sucesso
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
 *                   example: "Questão deletada com sucesso"
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores podem deletar questões"
 *       404:
 *         description: Questão ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Delete Question
router.delete("/:id", verifyToken, async (req, res) => {
    
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const questionId = req.params.id;
    const userId = userByToken._id.toString();

    try {
        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem deletar questões" });
        }

        // Soft delete: set deleted flag to true
        const updatedQuestion = await Question.findByIdAndUpdate(
            questionId,
            { $set: { deleted: true } },
            { new: true }
        );

        if (!updatedQuestion) {
            return res.status(404).json({ error: "Questão não encontrada" });
        }

        return res.status(200).json({error: null, msg: "Questão deletada com sucesso" });

    } catch (error) {
        return res.status(400).json({ error });
    }
});

/**
 * @swagger
 * /api/questions/{id}:
 *   put:
 *     summary: Atualizar questão
 *     description: Atualiza informações de uma questão existente (apenas admin)
 *     tags: [Questões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da questão
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Qual é o seu nome completo?"
 *               type:
 *                 type: string
 *                 enum: [text, multiple_choice, checkbox, dropdown, scale, date]
 *                 example: "text"
 *               options:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:
 *                       type: string
 *                     value:
 *                       type: string
 *               validation:
 *                 type: object
 *                 properties:
 *                   required:
 *                     type: boolean
 *                   minLength:
 *                     type: number
 *                   maxLength:
 *                     type: number
 *                   pattern:
 *                     type: string
 *           examples:
 *             atualizarTitulo:
 *               summary: Atualizar apenas título
 *               value:
 *                 title: "Qual é o seu nome completo?"
 *             atualizarCompleto:
 *               summary: Atualizar tudo
 *               value:
 *                 title: "Qual a sua idade?"
 *                 type: "multiple_choice"
 *                 options:
 *                   - label: "Menos de 18"
 *                     value: "under_18"
 *                   - label: "18-30"
 *                     value: "18_30"
 *                   - label: "31+"
 *                     value: "31_plus"
 *                 validation:
 *                   required: true
 *     responses:
 *       200:
 *         description: Questão atualizada com sucesso
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
 *                   example: "Questão atualizada com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Question'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores podem atualizar questões"
 *       404:
 *         description: Questão ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro ao atualizar a questão
 */
// Update Question
router.put("/:id", verifyToken, async (req, res) => {

    // Req Body
    const title = req.body.title;
    const type = req.body.type;
    const options = req.body.options;
    const validation = req.body.validation;
    const questionId = req.params.id;

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Verify user
    try {

        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem atualizar questões" });
        }

        // Find question
        const question = await Question.findOne({ _id: questionId, deleted: false });
        if (!question) {
            return res.status(404).json({ error: "Questão não encontrada" });
        }

        // Validate and update fields
        const validationResult = validateQuestionUpdate({ title, type, options, validation }, question);
        
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.error });
        }

        // Build question object
        const newQuestion = {};

        if (title !== undefined) {
            newQuestion.title = title.trim();
        }

        if (type !== undefined) {
            newQuestion.type = type;
        }

        if (options !== undefined) {
            newQuestion.options = options.map(opt => ({
                label: opt.label.trim(),
                value: opt.value.trim()
            }));
        }

        if (validation !== undefined) {
            newQuestion.validation = validation;
        }

        newQuestion.createdBy = user._id.toString();

        try {

            const updatedQuestion = await Question.findOneAndUpdate({ _id: questionId }, { $set: newQuestion }, { new: true });
            return res.status(200).json({ error: null, msg: "Questão atualizada com sucesso", data: updatedQuestion });

        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar a questão" });
        }

    } catch (error) {
        return res.status(400).json({ error: "Acesso Negado" });
    }
});

module.exports = router;