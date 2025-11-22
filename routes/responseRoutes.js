const router = require("express").Router();
const mongoose = require("mongoose");

// Models
const Response = require("../models/response");
const User = require("../models/user");
const Form = require("../models/form");

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');

// DRAFT ROUTES
/**
 * @swagger
 * /api/responses/draft:
 *   post:
 *     summary: Salvar rascunho de resposta
 *     description: Salva um rascunho de resposta para continuar depois
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               formId:
 *                 type: string
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     answer:
 *                       oneOf:
 *                         - type: string
 *                         - type: array
 *     responses:
 *       200:
 *         description: Rascunho salvo com sucesso
 *       201:
 *         description: Rascunho criado com sucesso
 */
// Create a draft response
router.post("/draft", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const { formId, answers } = req.body;

    try {

        // Verify token user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Validate formId
        if (!formId || !mongoose.Types.ObjectId.isValid(formId)) {
            return res.status(400).json({ error: "ID do formulário inválido" });
        }

        // Verify if form exists and is active
        const form = await Form.findOne({ _id: formId, deleted: false });
        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        if (!form.isActive) {
            return res.status(400).json({ error: "Este formulário não está mais ativo" });
        }

        // Validate answers format (but don't require all required fields for drafts)
        if (answers && !Array.isArray(answers)) {
            return res.status(400).json({ error: "Formato de respostas inválido" });
        }

        // Validate question IDs if answers exist
        if (answers && answers.length > 0) {
            const answerQuestionIds = answers.map(a => a.questionId);
            
            const invalidIds = answerQuestionIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({ error: "Um ou mais IDs de questão são inválidos" });
            }

            const formQuestionIds = form.questions.map(q => q.questionId.toString());
            for (const answerQId of answerQuestionIds) {
                if (!formQuestionIds.includes(answerQId.toString())) {
                    return res.status(400).json({ error: "Uma ou mais questões não pertencem a este formulário" });
                }
            }
        }

        // Check if draft already exists
        const existingDraft = await Response.findOne({ 
            formId: formId, 
            userId: userId, 
            deleted: false,
            isDraft: true 
        });

        if (existingDraft) {
            // Update existing draft
            existingDraft.answers = answers || [];
            existingDraft.lastModified = new Date();
            await existingDraft.save();

            return res.status(200).json({ 
                error: null,
                message: "Rascunho atualizado com sucesso!", 
                data: existingDraft 
            });

        } else {

            // Create new draft
            const draft = new Response({
                formId: form._id.toString(),
                userId: user._id.toString(),
                answers: answers || [],
                isDraft: true,
                lastModified: new Date()
            });

            const newDraft = await draft.save();
            return res.status(201).json({ 
                error: null,
                message: "Rascunho criado com sucesso!", 
                data: newDraft 
            });
        }

    } catch (error) {
        return res.status(500).json({ error: "Erro ao salvar rascunho" });
    }
});

/**
 * @swagger
 * /api/responses/draft/{formId}:
 *   get:
 *     summary: Recuperar rascunho de resposta
 *     description: Busca o rascunho salvo do usuário para um formulário específico
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 */
router.get("/draft/:formId", verifyToken, async (req, res) => {
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    const formId = req.params.formId;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Validate formId
        if (!mongoose.Types.ObjectId.isValid(formId)) {
            return res.status(400).json({ error: "ID do formulário inválido" });
        }
        
        // Find draft
        const draft = await Response.findOne({ 
            formId: formId, 
            userId: userId, 
            deleted: false,
            isDraft: true 
        })
        .populate({
            path: 'answers.questionId',
            select: 'title type options',
            match: { deleted: false }
        });

        if (!draft) {
            return res.status(200).json({ 
                error: null,
                msg: "Nenhum rascunho encontrado",
                data: null 
            });
        }

        return res.status(200).json({ 
            error: null,
            msg: "Rascunho encontrado com sucesso", 
            data: draft 
        });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao recuperar rascunho" });
    }

});

/**
 * @swagger
 * /api/responses/draft/{formId}:
 *   delete:
 *     summary: Deletar rascunho
 *     description: Remove o rascunho salvo do usuário
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 */
router.delete("/draft/:formId", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const formId = req.params.formId;

    try {
        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Validate formId
        if (!mongoose.Types.ObjectId.isValid(formId)) {
            return res.status(400).json({ error: "ID do formulário inválido" });
        }

        // Find and delete draft (soft delete)
        const draft = await Response.findOneAndUpdate(
            { 
                formId: formId, 
                userId: userId, 
                deleted: false,
                isDraft: true 
            },
            { $set: { deleted: true } },
            { new: true }
        );

        if (!draft) {
            return res.status(404).json({ error: "Rascunho não encontrado" });
        }

        return res.status(200).json({ 
            error: null,
            msg: "Rascunho deletado com sucesso" 
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro ao deletar rascunho" });
    }
});


// ADMIN ROUTES
/**
 * @swagger
 * /api/responses/all:
 *   get:
 *     summary: Listar todas as respostas
 *     description: Retorna todas as respostas submetidas no sistema (apenas admin e teacher_analyst)
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Respostas encontradas com sucesso
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
 *                   example: "Respostas encontradas com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Response'
 *                       - type: object
 *                         properties:
 *                           formId:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                           userId:
 *                             oneOf:
 *                               - type: object
 *                                 properties:
 *                                   _id:
 *                                     type: string
 *                                   name:
 *                                     type: string
 *                                   email:
 *                                     type: string
 *                               - type: object
 *                                 properties:
 *                                   name:
 *                                     type: string
 *                                     example: "Usuário Deletado"
 *                                   email:
 *                                     type: string
 *                                     example: "N/A"
 *                           answers:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 questionId:
 *                                   type: object
 *                                   properties:
 *                                     _id:
 *                                       type: string
 *                                     title:
 *                                       type: string
 *                                     type:
 *                                       type: string
 *                                     options:
 *                                       type: array
 *                                 answer:
 *                                   oneOf:
 *                                     - type: string
 *                                     - type: array
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores e equipe podem acessar todas as respostas"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 */
// Get all responses (ADMIN)
router.get("/admins/all", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Check user in Db
    try {
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;

        // Only 'admin' and 'teacher_analyst' can access all responses
        if (role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar todas as respostas" });
        }

        const responses = await Response.find({ deleted: false, isDraft: false })
            .sort({ submittedAt: -1 })
            .populate({
                path: 'formId',
                select: 'title description',
                match: { deleted: false }
            })
            .populate({
                path: 'userId',
                select: 'name email city state institution',
                match: { deleted: false }
            })
            .populate({
                path: 'answers.questionId',
                select: 'title type options',
                match: { deleted: false }
            });

        // Handle responses with deleted users and filter answers with null questionId
        const responsesWithDeletedUsers = responses
            .filter(response => response.formId !== null)
            .filter(response => response.userId !== null)
            .map(response => {
                const responseObj = response.toObject();

                // Filter answers to remove those with null questionId
                responseObj.answers = responseObj.answers.filter(a => a.questionId !== null);

                return responseObj;
            });

        return res.status(200).json({ 
            error: null, 
            msg: "Respostas encontradas com sucesso", 
            data: responsesWithDeletedUsers 
        });

        
    } catch (error) {
        return res.status(500).json({ error });
    }
});

/**
 * @swagger
 * /api/forms/{id}/respondents:
 *   get:
 *     summary: Listar usuários que responderam o formulário
 *     description: Retorna todos os usuários que já submeteram respostas para este formulário (apenas admin e teacher_analyst)
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
 *         description: Respondentes encontrados com sucesso
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
 *                   example: "Respondentes encontrados com sucesso"
 *                 formTitle:
 *                   type: string
 *                   example: "Pesquisa de Satisfação"
 *                 formDescription:
 *                   type: string
 *                   example: "Avalie nosso serviço"
 *                 totalRespondents:
 *                   type: number
 *                   example: 15
 *                 respondents:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       name:
 *                         type: string
 *                         example: "João Silva"
 *                       email:
 *                         type: string
 *                         example: "joao@email.com"
 *                       role:
 *                         type: string
 *                         enum: ['admin', 'student', 'teacher_analyst', 'teacher_respondent']
 *                         example: "user"
 *                       submittedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-11-16T14:30:00.000Z"
 *                       responseId:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439015"
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores e equipe podem acessar esta informação"
 *       404:
 *         description: Formulário ou usuário não encontrado
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
 *                   error: "Formulário não encontrado"
 *       500:
 *         description: Erro interno do servidor
 */
// Get respondents of a Form (ADMIN)
router.get("/admins/:formId/respondents", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const formId = req.params.formId;

    try {
        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Only admin can access
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem acessar esta informação" });
        }

        // Verify if form exists
        const form = await Form.findOne({ _id: formId, deleted: false });

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Get all responses for this form
        const responses = await Response.find({ formId: formId, deleted: false, isDraft: false })
            .populate({
                path: 'userId',
                select: 'name email role city state institution',
                match: { deleted: false }
            })
            .sort({ submittedAt: -1 });

        // Extract users with response details
        const respondents = responses.map(response => {
            if (response.userId) {
                return {
                    _id: response.userId._id,
                    name: response.userId.name,
                    email: response.userId.email,
                    role: response.userId.role,
                    submittedAt: response.submittedAt,
                    responseId: response._id
                };
            } else {
                // Handle deleted users
                return {
                    _id: null,
                    name: "Usuário Deletado",
                    email: "N/A",
                    role: "N/A",
                    submittedAt: response.submittedAt,
                    responseId: response._id
                };
            }
        });

        return res.status(200).json({
            error: null,
            msg: "Respondentes encontrados com sucesso",
            formTitle: form.title,
            formDescription: form.description,
            totalRespondents: respondents.length,
            respondents: respondents
        });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar respondentes" });
    }
});

/**
 * @swagger
 * /api/responses/{id}:
 *   get:
 *     summary: Obter resposta por ID
 *     description: Retorna uma resposta específica com todos os detalhes (apenas admin e teacher_analyst)
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da resposta
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Resposta encontrada com sucesso
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
 *                   example: "Resposta encontrada com sucesso"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Response'
 *                     - type: object
 *                       properties:
 *                         formId:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                               example: "Pesquisa de Satisfação"
 *                             description:
 *                               type: string
 *                         userId:
 *                           oneOf:
 *                             - type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                   example: "João Silva"
 *                                 email:
 *                                   type: string
 *                                   example: "joao@email.com"
 *                             - type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                   example: "Usuário Deletado"
 *                                 email:
 *                                   type: string
 *                                   example: "N/A"
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores e equipe podem acessar respostas específicas"
 *       404:
 *         description: Resposta ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado"
 *               respostaNaoEncontrada:
 *                 value:
 *                   error: "Resposta não encontrada"
 *       500:
 *         description: Erro interno do servidor
 */
// Get response by ID (admin/teacher_analyst only)
router.get("/admins/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const responseId = req.params.id;

    // Check user in Db
    try {
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        const role = user.role;

        // Only 'admin' can access response by ID
        if (role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem acessar respostas específicas" });
        }

        // Find response by ID
        const response = await Response.findOne({ _id: responseId, deleted: false })
            .populate({
                path: 'formId',
                select: 'title description',
                match: { deleted: false }
            })
            .populate({
                path: 'userId',
                select: 'name email city state institution',
                match: { deleted: false }
            })
            .populate({
                path: 'answers.questionId',
                select: 'title type options',
                match: { deleted: false }
            });

        if (!response) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        // Handle case where the user has been deleted
        const responseObj = response.toObject();
        
        if (!responseObj.userId) {
            responseObj.userId = {
                name: "Usuário Deletado",
                email: "N/A"
            };
        }

        // Filter answers to remove those with null questionId
        responseObj.answers = responseObj.answers.filter(a => a.questionId !== null);

        return res.status(200).json({ 
            error: null, 
            msg: "Resposta encontrada com sucesso", 
            data: responseObj 
        });

    } catch (error) {
        return res.status(500).json({ error });
    }
});


// ANALYST ROUTES
// Get All responses (ANALYSTS)
router.get("/analysts/all", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    try {

        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;

        // Only 'teacher_analyst' can access all responses
        if (role !== 'teacher_analyst') {
            return res.status(401).json({ error: "Acesso negado, apenas analistas podem acessar essas respostas" });
        }

        const responses = await Response.find({ deleted: false, isDraft: false })
            .sort({ submittedAt: -1 })
            .populate({
                path: 'formId',
                select: 'title description',
                match: { deleted: false }
            })
            .populate({
                path: 'userId',
                select: '_id name email city state institution anonymous',
                match: { deleted: false }
            })
            .populate({
                path: 'answers.questionId',
                select: 'title type options',
                match: { deleted: false }
            });

        // Handle responses with deleted users and filter answers with null questionId
        const responsesWithDeletedUsers = responses
            .filter(response => response.formId !== null)
            .filter(response => response.userId !== null)
            .map(response => {
                const responseObj = response.toObject();

                // If anonymous, return only _id in userId
                if (responseObj.userId.anonymous === true) {
                    responseObj.userId = { _id: responseObj.userId._id };
                }

                // Filter answers to remove those with null questionId
                responseObj.answers = responseObj.answers.filter(a => a.questionId !== null);

                return responseObj;
            });

        return res.status(200).json({ 
            error: null, 
            msg: "Respostas encontradas com sucesso", 
            data: responsesWithDeletedUsers 
        });

    } catch (error) {
        return res.status(500).json({ error });
    }

});

// Get respondents of a Form (ANALYSTS)
router.get("/analysts/:formId/respondents", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const formId = req.params.formId;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Only analysts can access
        if (user.role !== 'teacher_analyst') {
            return res.status(401).json({ error: "Acesso negado, apenas analistas podem acessar esta informação" });
        }

        // Verify if form exists
        const form = await Form.findOne({ _id: formId, deleted: false });

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Get all responses for this form
        const responses = await Response.find({ formId: formId, deleted: false, isDraft: false })
            .populate({
                path: 'userId',
                select: '_id name email city state institution anonymous',
                match: { deleted: false }
            })
            .sort({ submittedAt: -1 });

        // Extract users with response details
        const respondents = responses.map(response => {
            if (response.userId) {
                // Se for anônimo, só retorna o _id
                if (response.userId.anonymous === true) {
                    return {
                        _id: response.userId._id,
                        submittedAt: response.submittedAt,
                        responseId: response._id
                    };
                }
                // If not anonymous, return all data
                return {
                    _id: response.userId._id,
                    name: response.userId.name,
                    email: response.userId.email,
                    role: response.userId.role,
                    city: response.userId.city,
                    state: response.userId.state,
                    institution: response.userId.institution,
                    submittedAt: response.submittedAt,
                    responseId: response._id
                };
            } else {
                // Handle deleted users
                return {
                    _id: null,
                    name: "Usuário Deletado",
                    email: "N/A",
                    role: "N/A",
                    city: "N/A",
                    state: "N/A",
                    institution: "N/A",
                    submittedAt: response.submittedAt,
                    responseId: response._id
                };
            }
        });

        return res.status(200).json({
            error: null,
            msg: "Respondentes encontrados com sucesso",
            formTitle: form.title,
            formDescription: form.description,
            totalRespondents: respondents.length,
            respondents: respondents
        });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao buscar respondentes" });
    }
});

/**
 * @swagger
 * /api/responses/{id}:
 *   get:
 *     summary: Obter resposta por ID
 *     description: Retorna uma resposta específica com todos os detalhes (apenas admin e teacher_analyst)
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da resposta
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Resposta encontrada com sucesso
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
 *                   example: "Resposta encontrada com sucesso"
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Response'
 *                     - type: object
 *                       properties:
 *                         formId:
 *                           type: object
 *                           properties:
 *                             title:
 *                               type: string
 *                               example: "Pesquisa de Satisfação"
 *                             description:
 *                               type: string
 *                         userId:
 *                           oneOf:
 *                             - type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                   example: "João Silva"
 *                                 email:
 *                                   type: string
 *                                   example: "joao@email.com"
 *                             - type: object
 *                               properties:
 *                                 name:
 *                                   type: string
 *                                   example: "Usuário Deletado"
 *                                 email:
 *                                   type: string
 *                                   example: "N/A"
 *       401:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores e equipe podem acessar respostas específicas"
 *       404:
 *         description: Resposta ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado"
 *               respostaNaoEncontrada:
 *                 value:
 *                   error: "Resposta não encontrada"
 *       500:
 *         description: Erro interno do servidor
 */
// Get response by ID (ANALYSTS)
router.get("/analysts/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const responseId = req.params.id;

    // Check user in Db
    try {
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        const role = user.role;

        // Only 'teacher_analyst' can access response by ID
        if (role !== 'teacher_analyst') {
            return res.status(401).json({ error: "Acesso negado, apenas analistas podem acessar essa resposta específica" });
        }

        // Find response by ID
        const response = await Response.findOne({ _id: responseId, deleted: false })
            .populate({
                path: 'formId',
                select: 'title description',
                match: { deleted: false }
            })
            .populate({
                path: 'userId',
                select: '_id name email city state institution anonymous',
                match: { deleted: false }
            })
            .populate({
                path: 'answers.questionId',
                select: 'title type options',
                match: { deleted: false }
            });

        if (!response) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        // Handle case where the user has been deleted
        const responseObj = response.toObject();

        if (!responseObj.userId) {
            responseObj.userId = {
                name: "Usuário Deletado",
                email: "N/A"
            };
        } else if (responseObj.userId.anonymous === true) {
            // If anonymous, return only _id in userId
            responseObj.userId = { _id: responseObj.userId._id };
        } else {
            // If not anonymous, remove the anonymous field
            delete responseObj.userId.anonymous;
        }

        // Filter answers to remove those with null questionId
        responseObj.answers = responseObj.answers.filter(a => a.questionId !== null);

        return res.status(200).json({ 
            error: null, 
            msg: "Resposta encontrada com sucesso", 
            data: responseObj 
        });

    } catch (error) {
        return res.status(500).json({ error });
    }
});


// DIARY ROUTES
// Get if a user can answer the diary today
router.get("/diary/:formId/can-respond", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const formId = req.params.formId;

    try {
        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        // Verify form
        const form = await Form.findOne({ _id: formId, deleted: false });
        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Check if form is a diary
        if (form.type !== 'diary') {
            return res.status(400).json({ error: "O formulário não é um diário" });
        }

        // Check if user has already submitted a response today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const responseToday = await Response.findOne({
            formId: formId,
            userId: userId,
            deleted: false,
            isDraft: false,
            submittedAt: { $gte: today, $lte: todayEnd }
        });

        return  res.status(200).json({ 
            error: null, 
            msg: "Verificação concluída com sucesso", 
            canRespond: responseToday ? false : true 
        });
        
    } catch (error) {
        return res.status(500).json({ error: "Erro ao verificar se o usuário pode responder o diário hoje" });
    }
});


// GENERIC ROUTES
/**
 * @swagger
 * /api/responses:
 *   post:
 *     summary: Submeter resposta ao formulário
 *     description: Envia respostas para um formulário ativo. Valida questões obrigatórias e verifica duplicatas.
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResponseCreate'
 *           examples:
 *             respostaCompleta:
 *               summary: Resposta com múltiplas questões
 *               value:
 *                 formId: "507f1f77bcf86cd799439013"
 *                 answers:
 *                   - questionId: "507f1f77bcf86cd799439011"
 *                     answer: "João Silva"
 *                   - questionId: "507f1f77bcf86cd799439012"
 *                     answer: "PR"
 *                   - questionId: "507f1f77bcf86cd799439014"
 *                     answer: ["skins", "jogabilidade", "gratuito"]
 *                   - questionId: "507f1f77bcf86cd799439015"
 *                     answer: "10"
 *             respostaCheckbox:
 *               summary: Resposta com checkbox (array)
 *               value:
 *                 formId: "507f1f77bcf86cd799439013"
 *                 answers:
 *                   - questionId: "507f1f77bcf86cd799439014"
 *                     answer: ["opcao1", "opcao2", "opcao3"]
 *     responses:
 *       201:
 *         description: Resposta submetida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Resposta submetida com sucesso!"
 *                 data:
 *                   $ref: '#/components/schemas/Response'
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               formularioInvalido:
 *                 value:
 *                   error: "ID do formulário inválido"
 *               formularioInativo:
 *                 value:
 *                   error: "Este formulário não está mais ativo"
 *               formatoInvalido:
 *                 value:
 *                   error: "Formato de respostas inválido"
 *               idsInvalidos:
 *                 value:
 *                   error: "Um ou mais IDs de questão são inválidos"
 *               questaoNaoPertence:
 *                 value:
 *                   error: "Uma ou mais questões não pertencem a este formulário"
 *               respostaDuplicada:
 *                 value:
 *                   error: "Não é permitido responder a mesma questão mais de uma vez"
 *               respostaVazia:
 *                 value:
 *                   error: "Todas as respostas devem ter um valor"
 *               questaoObrigatoria:
 *                 value:
 *                   error: "A questão \"Qual o seu nome?\" é obrigatória"
 *               jaRespondido:
 *                 value:
 *                   error: "Você já respondeu este formulário"
 *       404:
 *         description: Formulário ou usuário não encontrado
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
 *                   error: "Formulário não encontrado"
 *       500:
 *         description: Erro ao enviar resposta
 */
// Create a response
router.post("/", verifyToken, async (req, res) => {
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const { formId, answers } = req.body;

    try {

        // Verify token user
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Validate formId
        if (!formId || !mongoose.Types.ObjectId.isValid(formId)) {
            return res.status(400).json({ error: "ID do formulário inválido" });
        }

        // Verify if form exists
        const form = await Form.findOne({ _id: formId }).populate('questions.questionId');

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        if (!form.isActive) {
            return res.status(400).json({ error: "Este formulário não está mais ativo" });
        }

        // If form is diary, check if user has already submitted today
        if (form.type === 'diary') {
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Zera as horas para comparar apenas a data
            
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);
            
            const responseToday = await Response.findOne({
                formId: formId,
                userId: userId,
                deleted: false,
                submittedAt: {
                    $gte: today,
                    $lte: todayEnd
                }
            });
            
            if (responseToday) {
                return res.status(400).json({ 
                    error: "Você já preencheu o diário hoje. Volte amanhã!" 
                });
            }
        }

        // Validate answers format
        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({ error: "Formato de respostas inválido" });
        }

        // Validate all question IDs and answers
        if (answers.length > 0) {
            const answerQuestionIds = answers.map(a => a.questionId);
            
            // Check for invalid IDs
            const invalidIds = answerQuestionIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({ error: "Um ou mais IDs de questão são inválidos" });
            }

            // Verify questions belong to the form
            const formQuestionIds = form.questions.map(q => q.questionId._id.toString());
            for (const answerQId of answerQuestionIds) {
                if (!formQuestionIds.includes(answerQId.toString())) {
                    return res.status(400).json({ error: "Uma ou mais questões não pertencem a este formulário" });
                }
            }

            // Check for duplicate question answers
            const uniqueQuestionIds = new Set(answerQuestionIds.map(id => id.toString()));
            if (uniqueQuestionIds.size !== answerQuestionIds.length) {
                return res.status(400).json({ error: "Não é permitido responder a mesma questão mais de uma vez" });
            }

            // Validate that answers have values
            for (const answer of answers) {
                if (answer.answer === undefined || answer.answer === null || answer.answer === '') {
                    return res.status(400).json({ error: "Todas as respostas devem ter um valor" });
                }
            }
        }

        // Verify required questions are answered
        const requiredQuestions = form.questions.filter(q => q.required);
        
        if (requiredQuestions.length > 0) {
            const answeredQuestionIds = answers.map(a => a.questionId.toString());
            
            for (const reqQuestion of requiredQuestions) {
                const questionIdStr = reqQuestion.questionId._id.toString();
                
                if (!answeredQuestionIds.includes(questionIdStr)) {
                    return res.status(400).json({ 
                        error: `A questão "${reqQuestion.questionId.title}" é obrigatória` 
                    });
                }
            }
        }

        // Verify if user already submitted this form
        const existingResponse = await Response.findOne({ 
            formId: formId, 
            userId: userId, 
            deleted: false, 
            isDraft: false 
        });

        if (existingResponse) {
            return res.status(400).json({ error: "Você já respondeu este formulário" });
        }

        await Response.updateMany(
            { 
                formId: formId, 
                userId: userId, 
                isDraft: true,
                deleted: false 
            },
            { $set: { deleted: true } }
        );

        // Create response object
        const response = new Response({
            formId: form._id.toString(),
            userId: user._id.toString(),
            answers: answers.map(a => ({
                questionId: a.questionId,
                answer: a.answer
            }))
        });

        // Save response
        const newResponse = await response.save();
        return res.status(201).json({ message: "Resposta submetida com sucesso!", data: newResponse });

    } catch (error) {
        return res.status(500).json({ error: "Erro ao enviar resposta" });
    }
});

/**
 * @swagger
 * /api/responses/{id}:
 *   delete:
 *     summary: Deletar resposta
 *     description: Remove uma resposta do sistema (apenas admin)
 *     tags: [Respostas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da resposta
 *         example: "507f1f77bcf86cd799439015"
 *     responses:
 *       200:
 *         description: Resposta deletada com sucesso
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
 *                   example: "Resposta deletada com sucesso"
 *       401:
 *         description: Acesso negado - apenas admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado, apenas administradores podem deletar respostas"
 *       404:
 *         description: Resposta ou usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado"
 *               respostaNaoEncontrada:
 *                 value:
 *                   error: "Resposta não encontrada"
 *       500:
 *         description: Erro interno do servidor
 */
// Delete a response by ID (ADMIN)
router.delete("/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const responseId = req.params.id;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;

        // Only 'admin' can delete responses
        if (role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem deletar respostas" });
        }

        // Soft delete: set deleted flag to true
        const updatedResponse = await Response.findByIdAndUpdate(
            responseId,
            { $set: { deleted: true } },
            { new: true }
        );

        if (!updatedResponse) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        return res.status(200).json({ error: null, msg: "Resposta deletada com sucesso" });

    } catch (error) {
        return res.status(500).json({ error });
    }
});


module.exports = router;