const mongoose = require('mongoose');

const formSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
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