const router = require('express').Router();

// Models
const Question = require('../models/question');
const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');
const { validateQuestion, validateQuestionUpdate } = require('../helpers/validate-question-fields');

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

        const user = await User.findOne({ _id: userId });

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

// Get all Questions for staff and admin
router.get("/all", verifyToken, async (req, res) => {
    try {

        const token = req.header("auth-token");
        const userByToken = await getUserByToken(token);
        const userId = userByToken._id.toString();

        // Verify user
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin' && user.role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar as questões" });
        }
        
        const questions = await Question.find()
            .sort({ createdAt: -1 })
            .populate('createdBy', 'name email role');

        return res.status(200).json({ error: null, msg: "Questões encontradas com sucesso", data: questions });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

// Get Question by ID
router.get("/:id", verifyToken, async (req, res) => {

    try {

        const token = req.header("auth-token");
        const userByToken = await getUserByToken(token);
        const userId = userByToken._id.toString();

        // Verify user
        const user = await User.findOne({ _id: userId });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin' && user.role !== 'staff') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores e equipe podem acessar as questões" });
        }

        const questionId = req.params.id;

        const question = await Question.findById(questionId)
            .populate('createdBy', 'name email role');

        if (!question) {
            return res.status(404).json({ error: "Questão não encontrada" });
        }

        return res.status(200).json({ error: null, msg: "Questão encontrada com sucesso", data: question });

    } catch (error) {
        return res.status(500).json({ error });
    }

});

// Delete Question
router.delete("/:id", verifyToken, async (req, res) => {
    
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const questionId = req.params.id;
    const userId = userByToken._id.toString();

    try {
        // Verify user
        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem deletar questões" });
        }

        // Verify if question exists and delete
        const deletedQuestion = await Question.findByIdAndDelete(questionId);

        if (!deletedQuestion) {
            return res.status(404).json({ error: "Questão não encontrada" });
        }

        return res.status(200).json({error: null, msg: "Questão deletada com sucesso" });

    } catch (error) {
        return res.status(400).json({ error });
    }
});

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

        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (user.role !== 'admin') {
            return res.status(401).json({ error: "Acesso negado, apenas administradores podem atualizar questões" });
        }

        // Find question
        const question = await Question.findOne({ _id: questionId });
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