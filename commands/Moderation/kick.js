const Discord = require('discord.js');
const warningSchema = require('../../schemas/warning-schema')
const settingsSchema = require('../../schemas/settings-schema');

module.exports = {
    name: 'kick',
    description: 'Kicks a user from the server',
    usage: 'kick <member> [reason]',
    aliases: ['boot'],
    async execute(client, message, args) {
        const roletoolower = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('I cannot kick this user, because my highest role is lower or the same than the provided members highest role')
            .setAuthor('Error', client.user.displayAvatarURL());

        const yourroletoolow = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('You cannot kick this user, because your role is either the same hoist or lower than the provided member')
            .setAuthor('Error', client.user.displayAvatarURL())

        const accessdenied = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('You do not have the required permissions to execute this command')
            .setAuthor('Error', client.user.displayAvatarURL());

        const missingarguser = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('User not specified / Not in guild')
            .setAuthor('Error', client.user.displayAvatarURL());

        const moderator = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('This user is a moderator, therefore I cannot kick them')
            .setAuthor('Error', client.user.displayAvatarURL());

        const missingperms = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('I do not have the permission to kick members. Please give me the `Kick Members` permission and run again')
            .setAuthor('Error', client.user.displayAvatarURL());

        const yourself = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .setDescription('You want to ban yourself... That\'s not happening')
            .setAuthor('Error', client.user.displayAvatarURL());

        if (!message.member.hasPermission('KICK_MEMBERS')) return message.channel.send(accessdenied);
        if (!message.guild.me.hasPermission('KICK_MEMBERS')) return message.channel.send(missingperms);

        if (!args[0]) return message.channel.send(missingarguser);

        var member;

        function getUserFromMention(mention) {
            if (!mention) return false;
            const matches = mention.match(/^<@!?(\d+)>$/);
            if (!matches) return mention;
            const id = matches[1];

            return id;
        }

        try {
            member = await message.guild.members.cache.find(member => member.id == parseInt(getUserFromMention(args[0])));
        } catch (err) {
            member = null
        }
        if (!member) return message.reply('There was an error catching this member. Maybe try a ping?')

        if (member) {
            if (member.hasPermission('MANAGE_MESSAGES')) return message.channel.send(moderator);
            if (message.member.roles.highest.position < member.roles.highest.position) {
                return message.channel.send(yourroletoolow)
            }
            if (member.id == message.author.id) return message.channel.send('Why tho')
        }

        var reason = args.splice(1).join(' ');
        let silent = false;
        if (!reason) {
            var reason = 'Unspecified'
        }
        if (reason.startsWith('-s')) silent = true;
        if (silent) message.delete();

        let date = new Date();
        date = date.getMonth() + 1 + '/' + date.getDate() + '/' + date.getFullYear();

        const kickmsg = new Discord.MessageEmbed()
            .setColor('#09fff2')
            .setDescription(`${member} has been kicked <a:check:800062847974375424>`)

        const kickmsgdm = new Discord.MessageEmbed()
            .setColor('#FF0000')
            .addField('Date', date, true)
            .addField('Reason', reason, true)
            .setAuthor(`You were kicked from ${message.guild.name}!`, client.user.displayAvatarURL())

        member.send(kickmsgdm).catch(() => { return })

        member.kick({reason: reason}).catch(() => {
            return message.channel.send(roletoolower)
        })

        if (!silent) message.channel.send(kickmsg)

        var code = '';
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        var charsLength = chars.length
        for (var i = 0; i < 15; i++) {
            code += chars.charAt(Math.floor(Math.random() * charsLength))
        }

        await new warningSchema({
            guildname: message.guild.name,
            guildid: message.guild.id,
            type: 'Kick',
            userid: member.id,
            reason: reason,
            code: code,
            date: date
        }).save();
        
    }
}