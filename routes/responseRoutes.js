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

        return res.status(200).json({ error: null, msg: "Respostas encontradas com sucesso", data: responses });

        
    } catch (error) {
        return res.status(500).json({ error });
    }
});

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

        return res.status(200).json({ error: null, msg: "Resposta encontrada com sucesso", data: response });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

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