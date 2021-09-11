const Discord = require('discord.js');
const settingsSchema = require('../schemas/settings-schema');
const ms = require('ms');

exports.run = async (client, message, args) => {

    if(args[1].toLowerCase() === 'current') {
        const guildSettings = await settingsSchema.findOne({ guildID: message.guild.id });
        const { manualwarnexpire } = guildSettings;
        
        const manualwarnexpireEmbed = new Discord.MessageEmbed()
        .setColor(client.config.colors.main)
        .setDescription(manualwarnexpire === 'disabled' ? 'Manual warnings are currently **not** set to expire if no duration is provided' : `All manual warnings, if no duration is provided, are set to expire in \`${client.util.duration(manualwarnexpire)}\``);

        return message.reply({ embeds: [manualwarnexpireEmbed]})
    }

    if (args[1].toLowerCase() === 'disable') {
        await settingsSchema.updateOne({
            guildID: message.guild.id
        },
            {
                manualwarnexpire: 'disabled'
            })

        const disableSuccess = new Discord.MessageEmbed()
            .setColor(client.config.colors.main)
            .setDescription(`${client.config.emotes.success} Success! Manual warnings with no duration specified will now never expire`)

        return message.reply({ embeds: [disableSuccess] })

    }

    const duration = ms(args[1])
    if (!duration) return await client.util.throwError(message, client.config.errors.missing_argument_duration);
    if (duration > 315576000000) return await client.util.throwError(message, client.config.errors.time_too_long);
    if (duration < 5000) return await client.util.throwError(message, 'The minimum time allowed is 5 seconds');

    await settingsSchema.updateOne({
        guildID: message.guild.id
    },
        {
            manualwarnexpire: duration
        })

    const success = new Discord.MessageEmbed()
        .setColor(client.config.colors.main)
        .setDescription(`${client.config.emotes.success} Success! Manual warnings with no duration specified will now expire in \`${client.util.duration(duration)}\``)

    return message.reply({ embeds: [success] })
}