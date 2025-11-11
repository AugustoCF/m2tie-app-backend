const router = require('express').Router();
const jwt = require('jsonwebtoken');

// Models
const Question = require('../models/question');
const User = require('../models/user');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');

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

    // Title Validation
    if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: "O título da questão é obrigatório" });
    }

    if (title.trim().length < 3) {
        return res.status(400).json({ error: "O título da questão deve ter no mínimo 3 caracteres" });
    }

    if (title.trim().length > 500) {
        return res.status(400).json({ error: "O título da questão deve ter no máximo 500 caracteres" });
    }

    // Type Validation
    const validTypes = ['text', 'multiple_choice', 'checkbox', 'dropdown', 'scale', 'date'];

    if (!type) {
        return res.status(400).json({ error: "O tipo da questão é obrigatório" });
    }

    if (!validTypes.includes(type)) {
        return res.status(400).json({ error: `Tipo inválido. Use: ${validTypes.join(', ')}` });
    }

    // Options Validation for types that require them
    const typesNeedingOptions = ['multiple_choice', 'checkbox', 'dropdown', 'scale'];

    if (typesNeedingOptions.includes(type)) {
    
        if (!options || !Array.isArray(options) || options.length === 0) {
            return res.status(400).json({ error: `Questões do tipo "${type}" precisam ter opções` });
        }

        // Minimun number of options: 2
        if (type !== 'scale' && options.length < 2) {
            return res.status(400).json({ error: `Questões do tipo "${type}" precisam ter no mínimo 2 opções` });
        }

        // Validate each option structure
        const seenValues = new Set();
        for (let i = 0; i < options.length; i++) {
            const option = options[i];

            // Check if option has label and value
            if (!option.label || !option.value) {
                return res.status(400).json({ error: `Opção ${i + 1} está incompleta. Precisa de "label" e "value"` });
            }

            // Check if label is not empty
            if (option.label.trim().length === 0) {
                return res.status(400).json({  error: `Opção ${i + 1}: o campo "label" não pode ser vazio` });
            }

            // Check if value is not empty
            if (option.value.trim().length === 0) {
                return res.status(400).json({ error: `Opção ${i + 1}: o campo "value" não pode ser vazio` });
            }

            // Check for duplicate values
            if (seenValues.has(option.value)) {
                return res.status(400).json({ error: `Valor duplicado encontrado: "${option.value}". Cada opção deve ter um valor único` });
            }

            seenValues.add(option.value);
        }

    } else {
        // Text and Date types should not have options
        if (options && options.length > 0) {
            return res.status(400).json({ error: `Questões do tipo "${type}" não devem ter opções` });
        }
    }

    // Validation Object Validation
    if (validation) {

        // text type specific validations
        if (type !== 'text') {
            if (validation.minLength || validation.maxLength || validation.pattern) {
                return res.status(400).json({ error: "minLength, maxLength e pattern só são válidos para questões do tipo 'text'" });
            }
        } else {

            // minLength Validation
            if (validation.minLength !== undefined && validation.minLength !== null) {
                if (typeof validation.minLength !== 'number' || validation.minLength < 0) {
                    return res.status(400).json({ error: "minLength deve ser um número maior ou igual a 0" });
                }
            }

            // maxLength Validation
            if (validation.maxLength !== undefined && validation.maxLength !== null) {
                if (typeof validation.maxLength !== 'number' || validation.maxLength <= 0) {
                    return res.status(400).json({ error: "maxLength deve ser um número maior que 0" });
                }

                // maxLength has to be greater than minLength
                if (validation.minLength && validation.maxLength <= validation.minLength) {
                    return res.status(400).json({ error: "maxLength deve ser maior que minLength" });
                }
            }

            // Regex Pattern Validation
            if (validation.pattern) {
                try {
                    new RegExp(validation.pattern);
                } catch (error) {
                    return res.status(400).json({ error: "pattern inválido. Deve ser uma expressão regular válida" });
                }
            }
        }
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
            return res.status(201).json({ msg: "Questão criada com sucesso", data: newQuestion });

        } catch (error) {
            return res.status(500).json({ error: "Erro ao criar a questão" });
        }

    } catch (error) {
        return res.status(400).json({ error: "Acesso Negado" });
    } 
});

module.exports = router;