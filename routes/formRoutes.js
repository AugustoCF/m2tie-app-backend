const router = require('express').Router();
const mongoose = require('mongoose');

// Models
const Form = require('../models/form');
const Question = require('../models/question');
const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');
const validateFormUpdate  = require('../helpers/validate-form-fields');

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

        const forms = await Form.find().sort({ createdAt: -1 }).populate('questions.questionId');

        return res.status(200).json({ error: null, msg: "Formulários encontrados com sucesso", data: forms });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

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

        const form = await Form.findOne({ _id: formId }).populate('questions.questionId');

        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado" });
        }

        return res.status(200).json({ error: null, msg: "Formulário encontrado com sucesso", data: form });

    } catch (error) {
        return res.status(500).json({ error });
    }
});

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