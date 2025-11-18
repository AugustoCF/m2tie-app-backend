const router = require('express').Router();

// Models
const Form = require('../models/form');
const Question = require('../models/question');
const User = require('../models/user');
const Response = require('../models/response');

// Middlewares
const verifyToken = require('../helpers/check-token');

// Helpers
const getUserByToken = require('../helpers/get-user-by-token');

/**
 * @swagger
 * /api/dashboards/analysis/{formId}/{questionId}:
 *   get:
 *     summary: Análise de uma questão específica
 *     description: Retorna estatísticas detalhadas de uma questão do formulário (apenas admin e teacher_analyst)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da questão
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Análise retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 question:
 *                   type: string
 *                   example: "Nível de satisfação"
 *                 questionType:
 *                   type: string
 *                   enum: [text, multiple_choice, checkbox, dropdown, scale, date]
 *                   example: "scale"
 *                 analysis:
 *                   type: object
 *                   oneOf:
 *                     - properties:
 *                         type:
 *                           type: string
 *                           example: "scale"
 *                         average:
 *                           type: string
 *                           example: "8.45"
 *                         min:
 *                           type: number
 *                           example: 1
 *                         max:
 *                           type: number
 *                           example: 10
 *                         distribution:
 *                           type: object
 *                           example: { "1": 2, "5": 8, "8": 25, "10": 115 }
 *                         totalAnswers:
 *                           type: number
 *                           example: 150
 *                     - properties:
 *                         type:
 *                           type: string
 *                           example: "checkbox"
 *                         distribution:
 *                           type: object
 *                           example: { "skins": 45, "jogabilidade": 89, "gratuito": 102 }
 *                         totalAnswers:
 *                           type: number
 *                           example: 150
 *       403:
 *         description: Acesso negado - apenas admin e teacher_analyst
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Acesso negado."
 *       404:
 *         description: Formulário ou questão não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               usuarioNaoEncontrado:
 *                 value:
 *                   error: "Usuário não encontrado."
 *               formularioNaoEncontrado:
 *                 value:
 *                   error: "Formulário não encontrado."
 *               questaoNaoEncontrada:
 *                 value:
 *                   error: "Questão não encontrada."
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 error:
 *                   type: string
 *             example:
 *               msg: "Erro ao buscar dados!"
 *               error: "Mensagem de erro detalhada"
 */
// Question Analysis from FormId and QuestionId
router.get("/analysis/:formId/:questionId", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request params
    const formId = req.params.formId;
    const questionId = req.params.questionId;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const role = user.role;
        if (role !== 'admin' && role !== 'teacher_analyst') {
            return res.status(403).json({ error: "Acesso negado." });
        }

        // Verify form
        const form = await Form.findOne({ _id: formId, deleted: false });
        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado." });
        }

        // Verify question
        const question = await Question.findOne({ _id: questionId, deleted: false });
        if (!question) {
            return res.status(404).json({ error: "Questão não encontrada." });
        }

        // Get responses
        const responses = await Response.find({ formId, deleted: false });

        // Filtra as respostas para remover answers com questionId null
        const filteredResponses = responses.map(response => {
            const filteredAnswers = response.answers.filter(a => a.questionId && a.questionId.toString() === questionId);
            return {
                ...response.toObject(),
                answers: filteredAnswers
            };
        });

        const answers = filteredResponses.map(r => r.answers[0]?.answer).filter(a => a !== undefined);

        // Analyze based on question type
        let analysis = {};

        switch (question.type) {
            case 'text':
                analysis = {
                    type: 'text',
                    totalAnswers: answers.length,
                    answers: answers
                };
                break;

            case 'multiple_choice':
            case 'dropdown':
                const choiceCounts = {};
                answers.forEach(a => {
                    choiceCounts[a] = (choiceCounts[a] || 0) + 1;
                });
                analysis = {
                    type: question.type,
                    distribution: choiceCounts,
                    totalAnswers: answers.length
                };
                break;

            case 'checkbox':
                const checkboxCounts = {};
                answers.forEach(a => {
                    const options = Array.isArray(a) ? a : a.split(',').map(s => s.trim());
                    options.forEach(opt => {
                        checkboxCounts[opt] = (checkboxCounts[opt] || 0) + 1;
                    });
                });
                analysis = {
                    type: 'checkbox',
                    distribution: checkboxCounts,
                    totalAnswers: answers.length
                };
                break;

            case 'scale':
                const scaleValues = answers.map(a => parseInt(a));
                const average = scaleValues.reduce((sum, val) => sum + val, 0) / scaleValues.length;
                const distribution = {};
                scaleValues.forEach(val => {
                    distribution[val] = (distribution[val] || 0) + 1;
                });
                analysis = {
                    type: 'scale',
                    average: average.toFixed(2),
                    min: Math.min(...scaleValues),
                    max: Math.max(...scaleValues),
                    distribution,
                    totalAnswers: answers.length
                };
                break;

            case 'date':
                const dates = answers.map(a => new Date(a));
                const sortedDates = dates.sort((a, b) => a - b);
                analysis = {
                    type: 'date',
                    earliest: sortedDates[0],
                    latest: sortedDates[sortedDates.length - 1],
                    answers: answers,
                    totalAnswers: answers.length
                };
                break;
        }

        return res.status(200).json({
            question: question.title,
            questionType: question.type,
            analysis
        });

    } catch (error) {
        return res.status(500).json({ msg: "Erro ao buscar dados!", error: error.message });
    }
});

/**
 * @swagger
 * /api/dashboards/full-analysis/{formId}:
 *   get:
 *     summary: Análise completa do formulário
 *     description: Retorna análise estatística de todas as questões do formulário (apenas admin e teacher_analyst)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Análise completa retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 formTitle:
 *                   type: string
 *                   example: "Pesquisa de Satisfação"
 *                 totalResponses:
 *                   type: number
 *                   example: 150
 *                 questionsAnalysis:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       questionId:
 *                         type: string
 *                         example: "507f1f77bcf86cd799439011"
 *                       title:
 *                         type: string
 *                         example: "Nível de satisfação"
 *                       type:
 *                         type: string
 *                         enum: [text, multiple_choice, checkbox, dropdown, scale, date]
 *                         example: "scale"
 *                       average:
 *                         type: string
 *                         example: "8.45"
 *                       min:
 *                         type: number
 *                         example: 1
 *                       max:
 *                         type: number
 *                         example: 10
 *                       distribution:
 *                         type: object
 *                         example: { "8": 25, "10": 115 }
 *                       sampleAnswers:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Resposta 1", "Resposta 2"]
 *                       range:
 *                         type: object
 *                         properties:
 *                           earliest:
 *                             type: string
 *                             format: date-time
 *                           latest:
 *                             type: string
 *                             format: date-time
 *                       totalAnswers:
 *                         type: number
 *                         example: 150
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Formulário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 error:
 *                   type: string
 */
// Full Analysis from FormId
router.get("/full-analysis/:formId", verifyToken, async (req, res) => {

    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request params
    const formId = req.params.formId;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const role = user.role;
        if (role !== 'admin' && role !== 'teacher_analyst') {
            return res.status(403).json({ error: "Acesso negado." });
        }

        // Verify form
        const form = await Form.findOne({ _id: formId, deleted: false })
            .populate({
                path: 'questions.questionId',
                match: { deleted: false }
            });
        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado." });
        }

        // Get responses
        const responses = await Response.find({ formId, deleted: false })
            .populate({
                path: 'userId',
                select: 'name email city state institution',
                match: { deleted: false }
            });

        // Filtra respostas de usuários deletados
        const filteredResponses = responses
            .filter(r => r.userId !== null)
            .map(response => {
                const filteredAnswers = response.answers.filter(a => a.questionId !== null);
                return {
                    ...response.toObject(),
                    answers: filteredAnswers
                };
            });

        // Filtra as questões do formulário para remover as que foram soft deleted
        const validQuestions = form.questions.filter(q => q.questionId !== null);

        const totalResponses = filteredResponses.length;
        const questionsAnalysis = [];

        for (const formQuestion of validQuestions) {
            const question = formQuestion.questionId;
            const questionId = question._id.toString();

            const answers = filteredResponses.map(r => {
                const answer = r.answers.find(a => a.questionId && a.questionId.toString() === questionId);
                return answer ? answer.answer : null;
            }).filter(a => a !== null);

            let analysis = { questionId, title: question.title, type: question.type };

            switch (question.type) {
                case 'multiple_choice':
                case 'dropdown':
                    const choiceCounts = {};
                    answers.forEach(a => {
                        choiceCounts[a] = (choiceCounts[a] || 0) + 1;
                    });
                    analysis.distribution = choiceCounts;
                    break;

                case 'checkbox':
                    const checkboxCounts = {};
                    answers.forEach(a => {
                        const options = Array.isArray(a) ? a : a.split(',').map(s => s.trim());
                        options.forEach(opt => {
                            checkboxCounts[opt] = (checkboxCounts[opt] || 0) + 1;
                        });
                    });
                    analysis.distribution = checkboxCounts;
                    break;

                case 'scale':
                    const scaleValues = answers.map(a => parseInt(a));
                    if (scaleValues.length > 0) {
                        const average = scaleValues.reduce((sum, val) => sum + val, 0) / scaleValues.length;
                        const distribution = {};
                        scaleValues.forEach(val => {
                            distribution[val] = (distribution[val] || 0) + 1;
                        });
                        analysis.average = average.toFixed(2);
                        analysis.min = Math.min(...scaleValues);
                        analysis.max = Math.max(...scaleValues);
                        analysis.distribution = distribution;
                    } else {
                        analysis.average = 0;
                        analysis.distribution = {};
                    }
                    break;

                case 'text':
                    analysis.sampleAnswers = answers.slice(0, 5);
                    break;

                case 'date':
                    const dates = answers.map(a => new Date(a));
                    const sortedDates = dates.sort((a, b) => a - b);
                    if (sortedDates.length > 0) {
                        analysis.range = {
                            earliest: sortedDates[0],
                            latest: sortedDates[sortedDates.length - 1]
                        };
                    } else {
                        analysis.range = null;
                    }
                    break;
            }

            analysis.totalAnswers = answers.length;
            questionsAnalysis.push(analysis);
        }

        return res.status(200).json({
            formTitle: form.title,
            totalResponses,
            questionsAnalysis
        });

    } catch (error) {
        return res.status(500).json({ msg: "Erro ao buscar dados!", error: error.message });
    }

});

/**
 * @swagger
 * /api/dashboards/export/{formId}:
 *   get:
 *     summary: Exportar dados do formulário
 *     description: Retorna dados em formato tabular para exportação (CSV/Excel) - apenas admin e teacher_analyst
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Dados exportados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 formTitle:
 *                   type: string
 *                   example: "Pesquisa de Satisfação"
 *                 totalResponses:
 *                   type: number
 *                   example: 150
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     additionalProperties: true
 *                   example:
 *                     - respondent: "João Silva"
 *                       email: "joao@email.com"
 *                       submittedAt: "2025-11-16T10:30:00.000Z"
 *                       "Qual o seu nome?": "João Silva"
 *                       "Nível de satisfação": "10"
 *                     - respondent: "Maria Santos"
 *                       email: "maria@email.com"
 *                       submittedAt: "2025-11-16T11:00:00.000Z"
 *                       "Qual o seu nome?": "Maria Santos"
 *                       "Nível de satisfação": "8"
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Formulário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro ao exportar dados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 error:
 *                   type: string
 */
// Export Data from FormId
router.get("/export/:formId", verifyToken, async (req, res) => {
    
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request params
    const formId = req.params.formId;

    try {

        // Verify user
        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const role = user.role;
        if (role !== 'admin' && role !== 'teacher_analyst') {
            return res.status(403).json({ error: "Acesso negado." });
        }

        // Verify form
        const form = await Form.findOne({ _id: formId, deleted: false })
            .populate({
                path: 'questions.questionId',
                match: { deleted: false }
            });
        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado." });
        }

        // Get responses
        const responses = await Response.find({ formId, deleted: false })
            .populate({
                path: 'userId',
                select: 'name email city state institution',
                match: { deleted: false }
            });

        // Após buscar o form:
        const validQuestions = form.questions.filter(q => q.questionId !== null);

        // Prepare data
        const exportData = responses
            .filter(response => response.userId) // Ignora respostas de usuários deletados
            .map(response => {
                const data = {
                    respondent: response.userId.name,
                    email: response.userId.email,
                    submittedAt: response.submittedAt
                };

                response.answers
                    .filter(answer => answer.questionId !== null) // só answers válidas
                    .forEach(answer => {
                        const question = validQuestions.find(q => 
                            q.questionId._id.toString() === answer.questionId.toString()
                        );
                        if (question) {
                            data[question.questionId.title] = Array.isArray(answer.answer) 
                                ? answer.answer.join(', ') 
                                : answer.answer;
                        }
                    });

                return data;
            });

        return res.status(200).json({
            formTitle: form.title,
            totalResponses: responses.length,
            data: exportData
        });

    } catch (error) {
        return res.status(500).json({ msg: "Erro ao exportar dados!", error: error.message });
    }
});

/**
 * @swagger
 * /api/dashboards/{formId}:
 *   get:
 *     summary: Obter todas as respostas brutas
 *     description: Retorna todas as respostas do formulário sem processamento estatístico (apenas admin e teacher_analyst)
 *     tags: [Dashboards]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: formId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do formulário
 *         example: "507f1f77bcf86cd799439013"
 *     responses:
 *       200:
 *         description: Respostas retornadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 message:
 *                   type: string
 *                   example: "Dados obtidos com sucesso!"
 *                 form:
 *                   type: string
 *                   example: "Pesquisa de Satisfação"
 *                 totalResponses:
 *                   type: number
 *                   example: 150
 *                 responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       formId:
 *                         type: string
 *                       userId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                       answers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             questionId:
 *                               type: string
 *                             answer:
 *                               oneOf:
 *                                 - type: string
 *                                 - type: array
 *                       submittedAt:
 *                         type: string
 *                         format: date-time
 *       403:
 *         description: Acesso negado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Formulário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Erro ao buscar dados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 msg:
 *                   type: string
 *                 error:
 *                   type: string
 */
// All Raw Responses from FormId
router.get("/:formId", verifyToken, async (req, res) => {
    
    // Token data
    const token = req.header("auth-token");
    const userByToken = await getUserByToken(token);
    const userId = userByToken._id.toString();

    // Request params
    const formId = req.params.formId;

    // Verify user
    try {

        const user = await User.findOne({ _id: userId, deleted: false });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const role = user.role;
        if (role !== 'admin' && role !== 'teacher_analyst') {
            return res.status(403).json({ error: "Acesso negado." });
        }

        // Verify form
        const form = await Form.findOne({ _id: formId, deleted: false });
        if (!form) {
            return res.status(404).json({ error: "Formulário não encontrado." });
        }

        // Get responses
        const totalResponses = await Response.countDocuments({ formId, deleted: false });
        const responses = await Response.find({ formId, deleted: false })
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

        // Filtra respostas cujo userId ficou null (usuário deletado)
        const filteredResponses = responses
            .filter(response => response.userId !== null)
            .map(response => {
                const filteredAnswers = response.answers.filter(a => a.questionId !== null);
                return {
                    ...response.toObject(),
                    answers: filteredAnswers
                };
            });

        return res.status(200).json({ 
            error: null, 
            message: "Dados obtidos com sucesso!", 
            form: form.title,
            totalResponses: filteredResponses.length,
            responses: filteredResponses
        });

    } catch (error) {
        return res.status(500).json({ msg: "Erro ao buscar dados!", error: error.message });
    }

});

module.exports = router;