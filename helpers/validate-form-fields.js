const mongoose = require('mongoose');


/**
 * Valida os dados de um formulário para ATUALIZAÇÃO (campos opcionais)
 * @param {Object} updateData - { title?, description?, questions?, isActive? }
 * @param {Object} currentForm - Formulário atual do banco
 * @returns {Object} { isValid: boolean, error: string|null }
 */
const validateFormUpdate = (updateData, currentForm) => {
    const { title, questions, assignedUsers, isActive } = updateData;

    // ===================================
    // 1. TITLE VALIDATION (se fornecido)
    // ===================================
    if (title !== undefined) {
        if (!title || title.trim().length === 0) {
            return { 
                isValid: false, 
                error: "O título do formulário não pode ser vazio" 
            };
        }

        if (title.trim().length < 3) {
            return { 
                isValid: false, 
                error: "O título do formulário deve ter no mínimo 3 caracteres" 
            };
        }

        if (title.trim().length > 200) {
            return { 
                isValid: false, 
                error: "O título do formulário deve ter no máximo 200 caracteres" 
            };
        }
    }

    // ===================================
    // 2. QUESTIONS VALIDATION (se fornecido)
    // ===================================
    if (questions !== undefined) {
        if (!Array.isArray(questions) || questions.length === 0) {
            return { 
                isValid: false, 
                error: "O formulário deve conter pelo menos uma questão" 
            };
        }

        // Validar cada questão
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];

            if (!question.questionId) {
                return { 
                    isValid: false, 
                    error: `Questão ${i + 1}: o campo "questionId" é obrigatório` 
                };
            }

            if (!mongoose.Types.ObjectId.isValid(question.questionId)) {
                return { 
                    isValid: false, 
                    error: `Questão ${i + 1}: o "questionId" não é um ID válido` 
                };
            }

            if (question.order !== undefined && (typeof question.order !== 'number' || question.order < 0)) {
                return { 
                    isValid: false, 
                    error: `Questão ${i + 1}: "order" deve ser um número maior ou igual a 0` 
                };
            }

            if (question.required !== undefined && typeof question.required !== 'boolean') {
                return { 
                    isValid: false, 
                    error: `Questão ${i + 1}: "required" deve ser true ou false` 
                };
            }
        }
    }

    // ===================================
    // 3. ASSIGNED USERS VALIDATION 
    // ===================================
    if (assignedUsers !== undefined) {
        if (!Array.isArray(assignedUsers)) {
            return { 
                isValid: false, 
                error: '"assignedUsers" deve ser um array' 
            };
        }

        // Permite array vazio - remove a validação de length === 0

        // Validar cada ID de usuário (se houver)
        if (assignedUsers.length > 0) {
            for (let i = 0; i < assignedUsers.length; i++) {
                const userId = assignedUsers[i];

                if (!userId) {
                    return { 
                        isValid: false, 
                        error: `Usuário ${i + 1}: o ID do usuário é obrigatório` 
                    };
                }

                if (!mongoose.Types.ObjectId.isValid(userId)) {
                    return { 
                        isValid: false, 
                        error: `Usuário ${i + 1}: o ID "${userId}" não é válido` 
                    };
                }
            }

            // Verificar duplicatas
            const uniqueUsers = [...new Set(assignedUsers.map(id => id.toString()))];
            if (uniqueUsers.length !== assignedUsers.length) {
                return { 
                    isValid: false, 
                    error: "A lista de usuários não pode conter IDs duplicados" 
                };
            }
        }
    }

    // ===================================
    // 4. ISACTIVE VALIDATION (se fornecido)
    // ===================================
    if (isActive !== undefined && typeof isActive !== 'boolean') {
        return { 
            isValid: false, 
            error: '"isActive" deve ser true ou false' 
        };
    }

    return { isValid: true, error: null };
};

module.exports = validateFormUpdate;