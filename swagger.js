const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'M2TIE API',
            version: '1.0.0',
            description: 'Sistema de Formulários Dinâmicos - API RESTful com autenticação JWT',
            contact: {
                name: 'Augusto Freitas',
                email: 'augustofreitas@alunos.utfpr.edu.br'
            },
            license: {
                name: 'ISC',
                url: 'https://opensource.org/licenses/ISC'
            }
        },
        servers: [
            {
                url: 'http://localhost:8000',
                description: 'Servidor de Desenvolvimento'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Insira o token JWT obtido no login'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    required: ['name', 'email', 'role'],
                    properties: {
                        _id: {
                            type: 'string',
                            description: 'ID do usuário',
                            example: '507f1f77bcf86cd799439011'
                        },
                        name: {
                            type: 'string',
                            description: 'Nome completo',
                            example: 'João Silva'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Email único',
                            example: 'joao@email.com'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'staff', 'user'],
                            description: 'Nível de acesso',
                            example: 'user'
                        }
                    }
                },
                Question: {
                    type: 'object',
                    required: ['title', 'type', 'createdBy'],
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        title: {
                            type: 'string',
                            description: 'Título da questão',
                            example: 'Qual o seu nome?'
                        },
                        type: {
                            type: 'string',
                            enum: ['text', 'multiple_choice', 'checkbox', 'dropdown', 'scale', 'date'],
                            description: 'Tipo de questão',
                            example: 'text'
                        },
                        options: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    label: { 
                                        type: 'string',
                                        example: 'Opção 1'
                                    },
                                    value: { 
                                        type: 'string',
                                        example: 'opcao_1'
                                    }
                                }
                            },
                            description: 'Opções para multiple_choice, checkbox e dropdown'
                        },
                        validation: {
                            type: 'object',
                            properties: {
                                required: { 
                                    type: 'boolean',
                                    default: false
                                },
                                minLength: { 
                                    type: 'number',
                                    example: 3
                                },
                                maxLength: { 
                                    type: 'number',
                                    example: 100
                                },
                                pattern: {
                                    type: 'string',
                                    example: '^[a-zA-Z]+$'
                                }
                            }
                        },
                        createdBy: {
                            type: 'string',
                            description: 'ID do usuário que criou',
                            example: '507f1f77bcf86cd799439011'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-11-16T10:30:00.000Z'
                        }
                    }
                },
                Form: {
                    type: 'object',
                    required: ['title', 'questions', 'createdBy'],
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439013'
                        },
                        title: {
                            type: 'string',
                            example: 'Pesquisa de Satisfação'
                        },
                        description: {
                            type: 'string',
                            example: 'Avalie nosso serviço'
                        },
                        questions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    questionId: { 
                                        type: 'string',
                                        example: '507f1f77bcf86cd799439011'
                                    },
                                    order: { 
                                        type: 'number',
                                        example: 1
                                    },
                                    required: { 
                                        type: 'boolean',
                                        example: true
                                    }
                                }
                            }
                        },
                        isActive: {
                            type: 'boolean',
                            default: true,
                            example: true
                        },
                        createdBy: {
                            type: 'string',
                            description: 'ID do usuário que criou',
                            example: '507f1f77bcf86cd799439011'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-11-16T10:30:00.000Z'
                        }
                    }
                },
                Response: {
                    type: 'object',
                    required: ['formId', 'userId', 'answers'],
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439015'
                        },
                        formId: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439013'
                        },
                        userId: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        answers: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    questionId: { 
                                        type: 'string',
                                        example: '507f1f77bcf86cd799439011'
                                    },
                                    answer: { 
                                        oneOf: [
                                            { type: 'string', example: 'João Silva' },
                                            { 
                                                type: 'array', 
                                                items: { type: 'string' },
                                                example: ['skins', 'jogabilidade']
                                            }
                                        ],
                                        description: 'String para respostas únicas, Array para checkbox'
                                    }
                                }
                            }
                        },
                        submittedAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2025-11-16T10:30:00.000Z'
                        }
                    }
                },
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            example: 'Erro ao processar requisição'
                        },
                        msg: {
                            type: 'string',
                            example: 'Mensagem de erro'
                        }
                    }
                }
            }
        },
        security: [{
            bearerAuth: []
        }],
        tags: [
            {
                name: 'Autenticação',
                description: 'Endpoints de autenticação e registro'
            },
            {
                name: 'Usuários',
                description: 'Gerenciamento de usuários'
            },
            {
                name: 'Questões',
                description: 'CRUD de questões'
            },
            {
                name: 'Formulários',
                description: 'CRUD de formulários'
            },
            {
                name: 'Respostas',
                description: 'Submissão e consulta de respostas'
            },
            {
                name: 'Dashboards',
                description: 'Análise e visualização de dados'
            }
        ]
    },
    apis: ['./routes/*.js']
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

module.exports = { swaggerUi, swaggerDocs };