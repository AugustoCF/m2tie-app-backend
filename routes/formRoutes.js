const router = require('express').Router();
const mongoose = require('mongoose');

// Models
const Form = require('../models/form');
const Question = require('../models/question');
const User = require('../models/user');
const Response = require('../models/response');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');
const validateFormUpdate  = require('../helpers/validate-form-fields');

/**
 * @swagger
 * /api/forms:
 *   post:
 *     summary: Criar novo formulário
 *     description: Cria um novo formulário com questões associadas (apenas admin)
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FormCreate'
 *           example:
 *             title: "Pesquisa de Satisfação 2025"
 *             description: "Avalie nosso serviço"
 *             questions:
 *               - questionId: "507f1f77bcf86cd799439011"
 *                 order: 1
 *                 required: true
 *               - questionId: "507f1f77bcf86cd799439012"
 *                 order: 2
 *                 required: false
 *             isActive: true
 *     responses:
 *       201:
 *         description: Formulário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Formulário criado com sucesso!"
 *                 data:
 *                   $ref: '#/components/schemas/Form'
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
 *               questoesObrigatorias:
 *                 value:
 *                   error: "O formulário deve conter pelo menos uma questão"
 *               idsInvalidos:
 *                 value:
 *                   error: "Um ou mais IDs de questão são inválidos"
 *               questoesNaoEncontradas:
 *                 value:
 *                   error: "Uma ou mais questões não foram encontradas"
 *       401:
 *         description: Apenas administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Apenas administradores podem criar formulários."
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Create new Form
router.post("/", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const title = req.body.title;
    const description = req.body.description;
    const questions = req.body.questions;
    const isActive = req.body.isActive;

    // Verify Admin user
    try {
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Apenas administradores podem criar formulários." });
        }

        // Validate fields
        if (!title || title.trim() === '') {
        return res.status(400).json({ error: "O título é obrigatório" });
        }

        if (!questions || !Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ error: "O formulário deve conter pelo menos uma questão" });
        }

        // Validate all question IDs
        const questionIds = questions.map(q => q.questionId);

        const invalidIds = questionIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({ error: "Um ou mais IDs de questão são inválidos" });
        }

        const existingQuestions = await Question.find({ _id: { $in: questionIds } });

        if (existingQuestions.length !== questionIds.length) {
            return res.status(400).json({ error: "Uma ou mais questões não foram encontradas" });
        }

        // Deactivate other forms if this one is active
        const formIsActive = isActive !== undefined ? isActive : true;

        if (formIsActive) {
            await Form.updateMany({},{ isActive: false } );
        }

        // Create form object
        const form = new Form({
            title: title.trim(),
            description: description?.trim() || '',
            questions: questions.map((q, index) => ({
                questionId: q.questionId,
                order: q.order !== undefined ? q.order : index,
                required: q.required || false
            })),
            isActive: formIsActive,
            createdBy: user._id.toString()
        });

        // Save form
        const newForm = await form.save();
        return res.status(201).json({ message: "Formulário criado com sucesso!", data: newForm });

    } catch (error) {
        return res.status(500).json({ error });
    }

});

/**
 * @swagger
 * /api/forms/all:
 *   get:
 *     summary: Listar todos os formulários
 *     description: Retorna todos os formulários cadastrados no sistema
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Formulários encontrados com sucesso
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
 *                   example: "Formulários encontrados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Form'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Get all Forms
router.get("/all", verifyToken, async (req, res) => {

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const forms = await Form.find()
            .sort({ createdAt: -1 })
            .populate('questions.questionId')
            .populate('createdBy', 'name email role');

        return res.status(200).json({ error: null, msg: "Formulários encontrados com sucesso", data: forms });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/active:
 *   get:
 *     summary: Obter formulário ativo
 *     description: Retorna o formulário atualmente ativo para resposta. Verifica se o usuário já respondeu.
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Formulário ativo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 msg:
 *                   type: string
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/Form'
 *                     - type: object
 *                       properties:
 *                         formTitle:
 *                           type: string
 *                         submittedAt:
 *                           type: string
 *                           format: date-time
 *                         responseId:
 *                           type: string
 *             examples:
 *               formularioDisponivel:
 *                 value:
 *                   error: null
 *                   msg: "Formulário ativo encontrado com sucesso"
 *                   data:
 *                     _id: "507f1f77bcf86cd799439013"
 *                     title: "Pesquisa de Satisfação"
 *                     description: "Avalie nosso serviço"
 *                     questions: []
 *                     isActive: true
 *               jaRespondido:
 *                 value:
 *                   error: null
 *                   msg: "Formulário já respondido"
 *                   data:
 *                     formTitle: "Pesquisa de Satisfação"
 *                     submittedAt: "2025-11-16T10:30:00.000Z"
 *                     responseId: "507f1f77bcf86cd799439015"
 *       404:
 *         description: Formulário ativo não encontrado ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado"
 *               formularioNaoEncontrado:
 *                 value:
 *                   error: "Formulário ativo não encontrado"
 *       500:
 *         description: Erro interno do servidor
 */
// Get Active Form
router.get("/active", verifyToken, async (req, res) => {
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const form = await Form.findOne({ isActive: true })
            .populate('questions.questionId')
            .populate('createdBy', 'name email role');

        if (!form) {
            return res.status(404).json({ error: "Formulário ativo não encontrado" });
        }

        // Check if the user has already responded to this form
        const existingResponse = await Response.findOne({ formId: form._id, userId: userId })
            .populate('formId', 'title description');

        if (existingResponse) {
            return res.status(200).json({ 
                error: null, 
                msg: "Formulário já respondido", 
                data: {
                    formTitle: existingResponse.formId.title,
                    submittedAt: existingResponse.submittedAt,
                    responseId: existingResponse._id
                }
            });
        }

        return res.status(200).json({ error: null, msg: "Formulário ativo encontrado com sucesso", data: form });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/{id}:
 *   get:
 *     summary: Obter formulário por ID
 *     description: Retorna um formulário específico com todas as suas questões
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Formulário encontrado com sucesso
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
 *                   example: "Formulário encontrado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Form'
 *       404:
 *         description: Formulário ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Get a Form by ID
router.get("/:id", verifyToken, async (req, res) => {
    const formId = req.params.id;

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const form = await Form.findOne({ _id: formId })
            .populate('questions.questionId')
            .populate('createdBy', 'name email role');

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Formulário encontrado com sucesso", data: form });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/{id}:
 *   delete:
 *     summary: Deletar formulário
 *     description: Remove um formulário do sistema (apenas admin)
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Formulário deletado com sucesso
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
 *                   example: "Formulário deletado com sucesso"
 *       401:
 *         description: Apenas administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Apenas administradores podem deletar formulários."
 *       404:
 *         description: Formulário ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Delete a Form by ID
router.delete("/:id", verifyToken, async (req, res) => {
    const formId = req.params.id;

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Apenas administradores podem deletar formulários." });
        }

        // Verify if form exists and delete
        const deletedForm = await Form.findByIdAndDelete(formId);

        if (!deletedForm) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Formulário deletado com sucesso" });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/{id}:
 *   put:
 *     summary: Atualizar formulário
 *     description: Atualiza informações de um formulário existente (apenas admin)
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Pesquisa de Satisfação 2025 - Atualizada"
 *               description:
 *                 type: string
 *                 example: "Nova descrição do formulário"
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     order:
 *                       type: number
 *                     required:
 *                       type: boolean
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Formulário atualizado com sucesso
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
 *                   example: "Formulário atualizado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Form'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Apenas administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Formulário ou questões não encontradas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Update a Form by ID
router.put("/:id", verifyToken, async (req, res) => {

    const formId = req.params.id;

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    const { title, description, questions, isActive } = req.body;

    try {

        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Apenas administradores podem atualizar formulários." });
        }

        const form = await Form.findOne({ _id: formId });

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Validate update data
        const validationResult = validateFormUpdate({ title, description, questions, isActive }, form);
        
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.error });
        }

        // Validate all question IDs exist in database
        if (questions !== undefined) {
            const questionIds = questions.map(q => q.questionId);
            const existingQuestions = await Question.find({ _id: { $in: questionIds } });

            if (existingQuestions.length !== questionIds.length) {
                return res.status(404).json({ error: "Uma ou mais questões não foram encontradas" });
            }
        }

        // Deactivate other forms if this one is being activated
        const formIsActive = isActive !== undefined ? isActive : form.isActive;

        if (formIsActive) {
            await Form.updateMany({ _id: { $ne: formId } }, { isActive: false });
        }

        // Build updated form object
        const updateData = {};

        if (title !== undefined) {
            updateData.title = title.trim();
        }

        if (description !== undefined) {
            updateData.description = description.trim() || '';
        }

        if (questions !== undefined) {
            updateData.questions = questions.map((q, index) => ({
                questionId: q.questionId,
                order: q.order !== undefined ? q.order : index,
                required: q.required || false
            }));
        }

        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        // Update form
        const updatedForm = await Form.findOneAndUpdate(
            { _id: formId }, 
            { $set: updateData }, 
            { new: true }
        ).populate('questions.questionId');

        return res.status(200).json({ 
            error: null, 
            msg: "Formulário atualizado com sucesso", 
            data: updatedForm 
        });

    } catch (error) {
        console.error('Erro ao atualizar formulário:', error);
        return res.status(500).json({ error: "Erro ao atualizar formulário" });
    }
});


module.exports = router;