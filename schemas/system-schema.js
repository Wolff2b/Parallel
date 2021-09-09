const mongoose = require('mongoose')

const reqString = {
    type: String,
    required: true
}

const systemSchema = mongoose.Schema({
    guildname: reqString,
    guildID: reqString,
    system: {
        type: [Object],
        required: true
    }
})

module.exports = mongoose.model('system', systemSchema)