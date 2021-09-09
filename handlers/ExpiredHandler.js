const warningSchema = require('../schemas/warning-schema');
const punishmentSchema = require('../schemas/punishment-schema');
const ExpiredLogger = require('../structures/ExpiredLogger');
const settingsSchema = require('../schemas/settings-schema');
const Discord = require('discord.js');

class ExpiredHandler {
    constructor(client) {
        setInterval(async () => {

            // Check for expired punishments

            const currentDate = Date.now();
            const expiredDate = await punishmentSchema.find({
                expires: { $lte: currentDate },
            })

            for(const expired of expiredDate) {
                const { type, userID, guildID, _id, roles } = expired;

                const settings = await settingsSchema.findOne({ guildID: guildID })
                const { muterole, removerolesonmute } = settings;

                if (type === 'mute') {

                    await punishmentSchema.deleteOne({
                        _id: _id,
                    })

                    const server = client.guilds.cache.get(guildID)
                    if (!server) return;


                    const role = server.roles.cache.get(muterole)
                    if (!role) return;

                    const member = await server.members.fetch(userID);
                    if (member) {

                        const rolesToAdd = roles?.filter(role => server.roles.cache.get(role) && !(role.managed && !member.roles.cache.has(role)) && server.roles.cache.get(role).position < server.me.roles.highest.position);
                        if (removerolesonmute && roles?.length) await member.roles.set(rolesToAdd);
                        else await member.roles.remove(role);

                        const unmuteDM = new Discord.MessageEmbed()
                        .setColor(client.config.colors.main)
                        .setAuthor('Parallel Moderation', client.user.displayAvatarURL())
                        .setTitle(`You were unmuted in ${server.name}`)
                        .addField('Reason', '[AUTO] Mute Expired')
                        .addField('Date', client.util.timestamp(Date.now()))

                        member.send({ embeds: [unmuteDM] })
                    }
                    
                    new ExpiredLogger(client, 'Unmuted', server, await client.users.fetch(userID), '[AUTO] Mute Expired')

                }

                if (type === 'ban') {

                    await punishmentSchema.deleteOne({
                        _id: _id
                    })

                    const server = await client.guilds.fetch(guildID)

                    await server.members.unban(userID).catch(() => { return })

                    new ExpiredLogger(client, 'Unbannned', server, await client.users.fetch(userID), '[AUTO] Ban Expired')
                }

            }

            // Check for expired warnings

            const expiredWarningDate = await warningSchema.find({
                warnings: {
                    $elemMatch: {
                        expires: { $lte: currentDate },
                        type: 'Warn'
                    }
                }
            })

            

            for (let i = 0; i !== expiredWarningDate.length; ++i) {
                let { _id } = expiredWarningDate[i]

                await warningSchema.updateOne({
                    _id: _id
                },
                    {
                        $pull: {
                            warnings: {
                                expires: {
                                    $lte: currentDate
                                }
                            }
                        }
                    })
            }

        }, 5000)
    }
}

module.exports = ExpiredHandler;