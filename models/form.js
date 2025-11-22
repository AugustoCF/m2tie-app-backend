const mongoose = require('mongoose');

const formSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['form', 'diary'],
        default: 'form'
    },
    questions: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question'
        },
    
        order: Number,
        
        required: { 
            type: Boolean, 
            default: false 
        }
    }],
    assignedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Form = mongoose.model('Form', formSchema);

module.exports = Form;