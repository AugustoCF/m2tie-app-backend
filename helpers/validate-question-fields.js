/**
 * Valida os dados de uma questão
 * @param {Object} questionData - { title, type, options, validation }
 * @returns {Object} { isValid: boolean, error: string|null }
 */

const validateQuestion = (questionData) => {
    const { title, type, options, validation } = questionData;

    // ===================================
    // 1. TITLE VALIDATION
    // ===================================
    if (!title || title.trim().length === 0) {
        return { 
            isValid: false, 
            error: "O título da questão é obrigatório" 
        };
    }

    if (title.trim().length < 3) {
        return { 
            isValid: false, 
            error: "O título da questão deve ter no mínimo 3 caracteres" 
        };
    }

    if (title.trim().length > 500) {
        return { 
            isValid: false, 
            error: "O título da questão deve ter no máximo 500 caracteres" 
        };
    }

    // ===================================
    // 2. TYPE VALIDATION
    // ===================================
    const validTypes = ['text', 'multiple_choice', 'checkbox', 'dropdown', 'scale', 'date'];

    if (!type) {
        return { 
            isValid: false, 
            error: "O tipo da questão é obrigatório" 
        };
    }

    if (!validTypes.includes(type)) {
        return { 
            isValid: false, 
            error: `Tipo inválido. Use: ${validTypes.join(', ')}` 
        };
    }

    // ===================================
    // 3. OPTIONS VALIDATION
    // ===================================
    const typesNeedingOptions = ['multiple_choice', 'checkbox', 'dropdown', 'scale'];

    if (typesNeedingOptions.includes(type)) {
        if (!options || !Array.isArray(options) || options.length === 0) {
            return { 
                isValid: false, 
                error: `Questões do tipo "${type}" precisam ter opções` 
            };
        }

        if (type !== 'scale' && options.length < 2) {
            return { 
                isValid: false, 
                error: `Questões do tipo "${type}" precisam ter no mínimo 2 opções` 
            };
        }

        const seenValues = new Set();
        for (let i = 0; i < options.length; i++) {
            const option = options[i];

            if (!option.label || !option.value) {
                return { 
                    isValid: false, 
                    error: `Opção ${i + 1} está incompleta. Precisa de "label" e "value"` 
                };
            }

            if (option.label.trim().length === 0) {
                return { 
                    isValid: false, 
                    error: `Opção ${i + 1}: o campo "label" não pode ser vazio` 
                };
            }

            if (option.value.trim().length === 0) {
                return { 
                    isValid: false, 
                    error: `Opção ${i + 1}: o campo "value" não pode ser vazio` 
                };
            }

            if (seenValues.has(option.value)) {
                return { 
                    isValid: false, 
                    error: `Valor duplicado encontrado: "${option.value}". Cada opção deve ter um valor único` 
                };
            }

            seenValues.add(option.value);
        }

    } else {
        if (options && options.length > 0) {
            return { 
                isValid: false, 
                error: `Questões do tipo "${type}" não devem ter opções` 
            };
        }
    }

    // ===================================
    // 4. VALIDATION OBJECT VALIDATION
    // ===================================
    if (validation) {
        if (type !== 'text') {
            if (validation.minLength !== undefined || 
                validation.maxLength !== undefined || 
                validation.pattern !== undefined) {
                return { 
                    isValid: false, 
                    error: "minLength, maxLength e pattern só são válidos para questões do tipo 'text'" 
                };
            }
        } else {
            if (validation.minLength !== undefined && validation.minLength !== null) {
                if (typeof validation.minLength !== 'number' || validation.minLength < 0) {
                    return { 
                        isValid: false, 
                        error: "minLength deve ser um número maior ou igual a 0" 
                    };
                }
            }

            if (validation.maxLength !== undefined && validation.maxLength !== null) {
                if (typeof validation.maxLength !== 'number' || validation.maxLength <= 0) {
                    return { 
                        isValid: false, 
                        error: "maxLength deve ser um número maior que 0" 
                    };
                }

                if (validation.minLength && validation.maxLength <= validation.minLength) {
                    return { 
                        isValid: false, 
                        error: "maxLength deve ser maior que minLength" 
                    };
                }
            }

            if (validation.pattern) {
                try {
                    new RegExp(validation.pattern);
                } catch (error) {
                    return { 
                        isValid: false, 
                        error: "pattern inválido. Deve ser uma expressão regular válida" 
                    };
                }
            }
        }
    }

    return { isValid: true, error: null };
};


/**
 * Valida os dados de uma questão para ATUALIZAÇÃO (campos opcionais)
 * @param {Object} updateData - { title?, type?, options?, validation? }
 * @param {Object} currentQuestion - Questão atual do banco
 * @returns {Object} { isValid: boolean, error: string|null }
 */
const validateQuestionUpdate = (updateData, currentQuestion) => {
    const { title, type, options, validation } = updateData;

    // ===================================
    // 1. TITLE VALIDATION (se fornecido)
    // ===================================
    if (title !== undefined) {
        if (!title || title.trim().length === 0) {
            return { 
                isValid: false, 
                error: "O título da questão não pode ser vazio" 
            };
        }

        if (title.trim().length < 3) {
            return { 
                isValid: false, 
                error: "O título da questão deve ter no mínimo 3 caracteres" 
            };
        }

        if (title.trim().length > 500) {
            return { 
                isValid: false, 
                error: "O título da questão deve ter no máximo 500 caracteres" 
            };
        }
    }

    // ===================================
    // 2. TYPE VALIDATION (se fornecido)
    // ===================================
    if (type !== undefined) {
        const validTypes = ['text', 'multiple_choice', 'checkbox', 'dropdown', 'scale', 'date'];

        if (!validTypes.includes(type)) {
            return { 
                isValid: false, 
                error: `Tipo inválido. Use: ${validTypes.join(', ')}` 
            };
        }
    }

    // Usar type do update ou type atual
    const finalType = type !== undefined ? type : currentQuestion.type;

    // ===================================
    // 3. OPTIONS VALIDATION (se fornecido)
    // ===================================
    const typesNeedingOptions = ['multiple_choice', 'checkbox', 'dropdown', 'scale'];

    // Se mudou o type para um que precisa de options
    if (type !== undefined && typesNeedingOptions.includes(type)) {
        const finalOptions = options !== undefined ? options : currentQuestion.options;

        if (!finalOptions || !Array.isArray(finalOptions) || finalOptions.length === 0) {
            return { 
                isValid: false, 
                error: `Questões do tipo "${type}" precisam ter opções` 
            };
        }

        if (type !== 'scale' && finalOptions.length < 2) {
            return { 
                isValid: false, 
                error: `Questões do tipo "${type}" precisam ter no mínimo 2 opções` 
            };
        }
    }

    // Se está atualizando options
    if (options !== undefined) {
        if (typesNeedingOptions.includes(finalType)) {
            if (!Array.isArray(options) || options.length === 0) {
                return { 
                    isValid: false, 
                    error: `Questões do tipo "${finalType}" precisam ter opções` 
                };
            }

            if (finalType !== 'scale' && options.length < 2) {
                return { 
                    isValid: false, 
                    error: `Questões do tipo "${finalType}" precisam ter no mínimo 2 opções` 
                };
            }

            const seenValues = new Set();
            for (let i = 0; i < options.length; i++) {
                const option = options[i];

                if (!option.label || !option.value) {
                    return { 
                        isValid: false, 
                        error: `Opção ${i + 1} está incompleta. Precisa de "label" e "value"` 
                    };
                }

                if (option.label.trim().length === 0) {
                    return { 
                        isValid: false, 
                        error: `Opção ${i + 1}: o campo "label" não pode ser vazio` 
                    };
                }

                if (option.value.trim().length === 0) {
                    return { 
                        isValid: false, 
                        error: `Opção ${i + 1}: o campo "value" não pode ser vazio` 
                    };
                }

                if (seenValues.has(option.value)) {
                    return { 
                        isValid: false, 
                        error: `Valor duplicado encontrado: "${option.value}". Cada opção deve ter um valor único` 
                    };
                }

                seenValues.add(option.value);
            }

        } else {
            // Type não precisa de options, mas options foi enviado
            if (options.length > 0) {
                return { 
                    isValid: false, 
                    error: `Questões do tipo "${finalType}" não devem ter opções` 
                };
            }
        }
    }

    // ===================================
    // 4. VALIDATION OBJECT VALIDATION (se fornecido)
    // ===================================
    if (validation !== undefined) {
        if (finalType !== 'text') {
            if (validation.minLength !== undefined || 
                validation.maxLength !== undefined || 
                validation.pattern !== undefined) {
                return { 
                    isValid: false, 
                    error: "minLength, maxLength e pattern só são válidos para questões do tipo 'text'" 
                };
            }
        } else {
            if (validation.minLength !== undefined && validation.minLength !== null) {
                if (typeof validation.minLength !== 'number' || validation.minLength < 0) {
                    return { 
                        isValid: false, 
                        error: "minLength deve ser um número maior ou igual a 0" 
                    };
                }
            }

            if (validation.maxLength !== undefined && validation.maxLength !== null) {
                if (typeof validation.maxLength !== 'number' || validation.maxLength <= 0) {
                    return { 
                        isValid: false, 
                        error: "maxLength deve ser um número maior que 0" 
                    };
                }

                if (validation.minLength && validation.maxLength <= validation.minLength) {
                    return { 
                        isValid: false, 
                        error: "maxLength deve ser maior que minLength" 
                    };
                }
            }

            if (validation.pattern) {
                try {
                    new RegExp(validation.pattern);
                } catch (error) {
                    return { 
                        isValid: false, 
                        error: "pattern inválido. Deve ser uma expressão regular válida" 
                    };
                }
            }
        }
    }

    return { isValid: true, error: null };
};

module.exports = {
    validateQuestion,
    validateQuestionUpdate
};