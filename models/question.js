const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'multiple_choice', 'checkbox', 'dropdown', 'scale', 'date'],
        required: true
    },
    options: [{
        label: String,
        value: String
    }],
    validation: {
        required: { type: Boolean, default: false },
        minLength: Number,
        maxLength: Number,
        pattern: String
    },
    deleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;