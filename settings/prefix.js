const settingsSchema = require('../schemas/settings-schema')

exports.run = async(client, message, args) => {
    if (!args[1]) return message.channel.send('Please specify a prefix')
    let prefix = args[1]

    await settingsSchema.updateOne({
        guildid: message.guild.id
    }, {
        prefix: prefix
    })
    message.channel.send(`The server prefix for razor is now \`${prefix}\`. You can ping me for the prefix if you ever forget`)
}