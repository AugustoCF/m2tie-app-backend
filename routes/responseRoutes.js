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
        const user = await User.findOne({ _id: userId });

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
        const existingResponse = await Response.findOne({ formId: formId, userId: userId });

        if (existingResponse) {
            return res.status(400).json({ error: "Você já respondeu este formulário" });
        }

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
 * /api/responses/all:
 *   get:
 *     summary: Listar todas as respostas
 *     description: Retorna todas as respostas submetidas no sistema (apenas admin e staff)
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
// Get all responses (admin/staff only)
router.get("/all", verifyToken, async (req, res) => {
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Check user in Db
    try {
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;

        // Only 'admin' and 'staff' can access all responses
        if (role !== 'admin' && role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar todas as respostas" });
        }

        const responses = await Response.find()
            .sort({ submittedAt: -1 })
            .populate('formId', 'title description')
            .populate('userId', 'name email')
            .populate('answers.questionId', 'title type options');

        // Tratar respostas com usuários deletados
        const responsesWithDeletedUsers = responses.map(response => {
            const responseObj = response.toObject();
            
            // Se userId for null, substituir por "Usuário Deletado"
            if (!responseObj.userId) {
                responseObj.userId = {
                    name: "Usuário Deletado",
                    email: "N/A"
                };
            }
            
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
 *     description: Retorna todos os usuários que já submeteram respostas para este formulário (apenas admin e staff)
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
 *                         enum: [user, admin, staff]
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
// Get respondents of a Form
router.get("/:formId/respondents", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const formId = req.params.formId;

    try {
        // Verify user
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        // Only admin and staff can access
        if (user.role !== 'admin' && user.role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar esta informação" });
        }

        // Verify if form exists
        const form = await Form.findOne({ _id: formId });

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        // Get all responses for this form
        const responses = await Response.find({ formId: formId })
            .populate('userId', 'name email role')
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
 *     description: Retorna uma resposta específica com todos os detalhes (apenas admin e staff)
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
// Get response by ID (admin/staff only)
router.get("/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const responseId = req.params.id;

    // Check user in Db
    try {
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        const role = user.role;

        // Only 'admin' and 'staff' can access response by ID
        if (role !== 'admin' && role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar respostas específicas" });
        }

        // Find response by ID
        const response = await Response.findOne({ _id: responseId })
            .populate('formId', 'title description')
            .populate('userId', 'name email')
            .populate('answers.questionId', 'title type options');

        if (!response) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        // Tratar caso o usuário tenha sido deletado
        const responseObj = response.toObject();
        
        if (!responseObj.userId) {
            responseObj.userId = {
                name: "Usuário Deletado",
                email: "N/A"
            };
        }

        return res.status(200).json({ 
            error: null, 
            msg: "Resposta encontrada com sucesso", 
            data: responseObj 
        });

    } catch (error) {
        return res.status(500).json({ error });
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
// Delete a response by ID (admin only)
router.delete("/:id", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request data
    const responseId = req.params.id;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const role = user.role;

        // Only 'admin' can delete responses
        if (role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem deletar respostas" });
        }

        // Delete response by ID
        const deletedResponse = await Response.findByIdAndDelete(responseId);

        if (!deletedResponse) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        return res.status(200).json({ error: null, msg: "Resposta deletada com sucesso" });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

module.exports = router;