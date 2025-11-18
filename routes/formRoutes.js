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
 *     description: Cria um novo formulário com questões e usuários associados (apenas admin)
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
 *             assignedUsers:
 *               - "507f1f77bcf86cd799439021"
 *               - "507f1f77bcf86cd799439022"
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
 *               usuariosObrigatorios:
 *                 value:
 *                   error: "O formulário deve ter pelo menos um usuário associado"
 *               idsInvalidos:
 *                 value:
 *                   error: "Um ou mais IDs de questão são inválidos"
 *               questoesNaoEncontradas:
 *                 value:
 *                   error: "Uma ou mais questões não foram encontradas"
 *               usuariosInvalidos:
 *                 value:
 *                   error: "Um ou mais usuários não foram encontrados ou não são respondentes"
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
    const assignedUsers = req.body.assignedUsers;
    const isActive = req.body.isActive;

    // Verify Admin user
    try {
        const user = await User.findOne({ _id: userId, deleted: false });

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

        const existingQuestions = await Question.find({ _id: { $in: questionIds }, deleted: false });

        if (existingQuestions.length !== questionIds.length) {
            return res.status(400).json({ error: "Uma ou mais questões não foram encontradas" });
        }

        // Validate assignedUsers if provided
        if (assignedUsers && Array.isArray(assignedUsers) && assignedUsers.length > 0) {
            const invalidUserIds = assignedUsers.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidUserIds.length > 0) {
                return res.status(400).json({ error: "Um ou mais IDs de usuário são inválidos" });
            }

            const existingUsers = await User.find({ 
                _id: { $in: assignedUsers }, 
                deleted: false,
                role: { $in: ['student', 'teacher_respondent'] } 
            });

            if (existingUsers.length !== assignedUsers.length) {
                return res.status(400).json({ error: "Um ou mais usuários não foram encontrados ou não são respondentes" });
            }
        }

        const formIsActive = isActive !== undefined ? isActive : true;

        // Create form object
        const form = new Form({
            title: title.trim(),
            description: description?.trim() || '',
            questions: questions.map((q, index) => ({
                questionId: q.questionId,
                order: q.order !== undefined ? q.order : index,
                required: q.required || false
            })),
            assignedUsers: assignedUsers || [], 
            isActive: formIsActive,
            createdBy: user._id.toString()
        });

        // Save form
        const newForm = await form.save();

        // Populate para retornar dados completos
        const populatedForm = await Form.findById(newForm._id)
            .populate({
                path: 'questions.questionId',
                match: { deleted: false }
            })
            .populate({
                path: 'assignedUsers',
                select: 'name email role city state institution',
                match: { deleted: false }
            })
            .populate({
                path: 'createdBy',
                select: 'name email role',
                match: { deleted: false }
            });

        return res.status(201).json({ 
            message: "Formulário criado com sucesso!", 
            data: populatedForm 
        });

    } catch (error) {
        console.error('Erro ao criar formulário:', error);
        return res.status(500).json({ error: "Erro ao criar formulário" });
    }

});

/**
 * @swagger
 * /api/forms/all:
 *   get:
 *     summary: Listar todos os formulários
 *     description: Retorna todos os formulários cadastrados no sistema com informações de usuários atribuídos e respostas
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
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const forms = await Form.find({ deleted: false })
            .sort({ createdAt: -1 })
            .populate({
                path: 'questions.questionId',
                match: { deleted: false }
            })
            .populate({
                path: 'assignedUsers',
                select: 'name email role city state institution',
                match: { deleted: false }
            })
            .populate({
                path: 'createdBy',
                select: 'name email role city state institution',
                match: { deleted: false }
            });

        // Para cada formulário, conte as respostas válidas
        const formsWithResponseCount = await Promise.all(forms.map(async form => {
            const responses = await Response.find({
                formId: form._id,
                deleted: false
            }).populate({
                path: 'userId',
                match: { deleted: false }
            });
            const validResponsesCount = responses.filter(r => r.userId !== null).length;

            const filteredQuestions = form.questions.filter(q => q.questionId !== null);
            const filteredAssignedUsers = form.assignedUsers.filter(u => u !== null);

            return {
                ...form.toObject(),
                questions: filteredQuestions,
                assignedUsers: filteredAssignedUsers,
                totalResponses: validResponsesCount,
                totalAssigned: filteredAssignedUsers.length
            };
        }));

        return res.status(200).json({ 
            error: null, 
            msg: "Formulários encontrados com sucesso", 
            data: formsWithResponseCount 
        });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/active:
 *   get:
 *     summary: Obter formulários ativos do usuário logado
 *     description: Retorna todos os formulários ativos que foram atribuídos ao usuário logado, indicando quais já foram respondidos
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Formulários ativos encontrados
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
 *                   example: "Formulários ativos encontrados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Form'
 *                       - type: object
 *                         properties:
 *                           hasResponded:
 *                             type: boolean
 *                             description: Se o usuário já respondeu este formulário
 *                           responseId:
 *                             type: string
 *                             format: objectId
 *                             nullable: true
 *                           submittedAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *             example:
 *               error: null
 *               msg: "Formulários ativos encontrados com sucesso"
 *               data:
 *                 - _id: "507f1f77bcf86cd799439013"
 *                   title: "Pesquisa de Satisfação"
 *                   description: "Avalie nosso serviço"
 *                   questions: []
 *                   isActive: true
 *                   hasResponded: false
 *                   responseId: null
 *                   submittedAt: null
 *                 - _id: "507f1f77bcf86cd799439014"
 *                   title: "Avaliação de Curso"
 *                   hasResponded: true
 *                   responseId: "507f1f77bcf86cd799439030"
 *                   submittedAt: "2025-11-16T10:30:00.000Z"
 *       404:
 *         description: Usuário não encontrado ou nenhum formulário ativo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado"
 *               nenhumFormulario:
 *                 value:
 *                   error: "Nenhum formulário ativo encontrado para este usuário"
 *       500:
 *         description: Erro interno do servidor
 */
// Get Active Form
router.get("/active", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const forms = await Form.find({ 
            assignedUsers: userId,
            isActive: true,
            deleted: false 
        })
            .sort({ createdAt: -1 })
            .populate({
                path: 'questions.questionId',
                match: { deleted: false }
            })
            .populate({
                path: 'createdBy',
                select: 'name email role city state institution',
                match: { deleted: false }
            });

        if (!forms || forms.length === 0) {
            return res.status(200).json({ error: null, msg: "Nenhum formulário ativo encontrado para este usuário", data: [] });
        }

        // Para cada formulário, verifica se o usuário já respondeu
        const formsWithStatus = await Promise.all(forms.map(async form => {
            const response = await Response.findOne({
                formId: form._id,
                userId: userId,
                deleted: false
            });

            const filteredQuestions = form.questions.filter(q => q.questionId !== null);

            return {
                ...form.toObject(),
                questions: filteredQuestions,
                hasResponded: !!response,
                responseId: response?._id,
                submittedAt: response?.createdAt
            };
        }));

        return res.status(200).json({ 
            error: null, 
            msg: "Formulários ativos encontrados com sucesso", 
            data: formsWithStatus
        });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar formulários ativos" });
    }
});

/**
 * @swagger
 * /api/forms/{formId}:
 *   get:
 *     summary: Obter formulário por ID (Admin/Analista apenas)
 *     description: Retorna um formulário específico com todas as informações. Acesso restrito a admins e analistas.
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
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
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado ao formulário"
 *       404:
 *         description: Formulário ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Get a Form by ID - ADMIN AND TEACHER_ANALYST ONLY
router.get("/:formId", verifyToken, async (req, res) => {
    const formId = req.params.formId;

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;
        if (role !== 'admin' && role !== 'teacher_analyst') {
            return res.status(403).json({ error: "Acesso negado ao formulário" });
        }

        const form = await Form.findOne({ _id: formId, deleted: false })
            .populate({
                path: 'questions.questionId',
                match: { deleted: false }
            })
            .populate({
                path: 'assignedUsers',
                select: 'name email role city state institution',
                match: { deleted: false }
            })
            .populate({
                path: 'createdBy',
                select: 'name email role city state institution',
                match: { deleted: false }
            });

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Filtra as questões para remover as que têm questionId null
        const filteredQuestions = form.questions.filter(q => q.questionId !== null);
        const filteredAssignedUsers = form.assignedUsers.filter(u => u !== null);

        // Retorna o formulário com as questões filtradas
        return res.status(200).json({ 
            error: null, 
            msg: "Formulário encontrado com sucesso", 
            data: { ...form.toObject(), questions: filteredQuestions, assignedUsers: filteredAssignedUsers }
        });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/{formId}:
 *   delete:
 *     summary: Deletar formulário (Admin apenas)
 *     description: Remove um formulário do sistema (soft delete). Apenas administradores.
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
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
router.delete("/:formId", verifyToken, async (req, res) => {
    const formId = req.params.formId;

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Apenas administradores podem deletar formulários." });
        }

        const updatedForm = await Form.findByIdAndUpdate(
            formId,
            { $set: { deleted: true } },
            { new: true }
        );

        if (!updatedForm) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Formulário deletado com sucesso" });

    } catch (error) {
        console.error('Erro ao deletar formulário:', error);
        return res.status(500).json({ error: "Erro ao deletar formulário" });
    }
});

/**
 * @swagger
 * /api/forms/{formId}:
 *   put:
 *     summary: Atualizar formulário (Admin apenas)
 *     description: Atualiza informações de um formulário existente, incluindo usuários atribuídos. Apenas administradores.
 *     tags: [Formulários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
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
 *                 minLength: 3
 *                 maxLength: 200
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
 *                       format: objectId
 *                     order:
 *                       type: integer
 *                       minimum: 0
 *                     required:
 *                       type: boolean
 *               assignedUsers:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   format: objectId
 *                 example: ["507f1f77bcf86cd799439021", "507f1f77bcf86cd799439023"]
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
 *             examples:
 *               tituloInvalido:
 *                 value:
 *                   error: "O título do formulário deve ter no mínimo 3 caracteres"
 *               usuariosVazio:
 *                 value:
 *                   error: "O formulário deve ter pelo menos um usuário associado"
 *       401:
 *         description: Apenas administradores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Formulário, questões ou usuários não encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Update a Form by ID
router.put("/:formId", verifyToken, async (req, res) => {

    const formId = req.params.formId;

    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    const { title, description, questions, assignedUsers, isActive } = req.body;

    try {

        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Apenas administradores podem atualizar formulários." });
        }

        const form = await Form.findOne({ _id: formId, deleted: false });

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Validate update data
        const validationResult = validateFormUpdate({ title, description, questions, assignedUsers, isActive }, form);
        
        if (!validationResult.isValid) {
            return res.status(400).json({ error: validationResult.error });
        }

        // Validate all question IDs exist in database
        if (questions !== undefined) {
            const questionIds = questions.map(q => q.questionId);
            const existingQuestions = await Question.find({ _id: { $in: questionIds }, deleted: false });

            if (existingQuestions.length !== questionIds.length) {
                return res.status(404).json({ error: "Uma ou mais questões não foram encontradas" });
            }
        }

        // Validate assignedUsers if provided 
        if (assignedUsers !== undefined && assignedUsers !== null) {
            if (!Array.isArray(assignedUsers)) {
                return res.status(400).json({ error: "assignedUsers deve ser um array" });
            }

            if (assignedUsers.length > 0) {
                const invalidUserIds = assignedUsers.filter(id => !mongoose.Types.ObjectId.isValid(id));
                if (invalidUserIds.length > 0) {
                    return res.status(400).json({ error: "Um ou mais IDs de usuário são inválidos" });
                }

                const existingUsers = await User.find({ 
                    _id: { $in: assignedUsers }, 
                    deleted: false,
                    role: { $in: ['student', 'teacher_respondent'] }
                });

                if (existingUsers.length !== assignedUsers.length) {
                    return res.status(400).json({ error: "Um ou mais usuários não foram encontrados ou não são respondentes" });
                }
            }
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

        if (assignedUsers !== undefined) {
            updateData.assignedUsers = assignedUsers;
        }

        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        // Update form
        const updatedForm = await Form.findOneAndUpdate(
            { _id: formId }, 
            { $set: updateData }, 
            { new: true }
        )
        .populate({
            path: 'questions.questionId',
            match: { deleted: false }
        })
        .populate({
            path: 'assignedUsers',
            select: 'name email role city state institution',
            match: { deleted: false }
        })
        .populate({
            path: 'createdBy',
            select: 'name email role',
            match: { deleted: false }
        });

        const filteredQuestions = updatedForm.questions.filter(q => q.questionId !== null);
        const filteredAssignedUsers = updatedForm.assignedUsers.filter(u => u !== null);

        return res.status(200).json({ 
            error: null, 
            msg: "Formulário atualizado com sucesso", 
            data: { 
                ...updatedForm.toObject(), 
                questions: filteredQuestions, 
                assignedUsers: filteredAssignedUsers 
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar formulário:', error);
        return res.status(500).json({ error: "Erro ao atualizar formulário" });
    }
});


module.exports = router;