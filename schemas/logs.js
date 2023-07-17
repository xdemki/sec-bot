const { default: mongoose } = require("mongoose");

module.exports = mongoose.model('logs', new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: false
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    createdAt: {
        type: Number,
        default: new Date().getTime()
    },
    type: {
        required: true,
        type: String,
        default: 'Client Security'
    },
    attachments: {
        required: false,
        type: Array,
        default: []
    },
    warn: {
        required: false,
        type: Object
    }
}));