import { InfractionType } from '@prisma/client';
import {
  SlashCommandBuilder,
  PermissionFlagsBits as Permissions,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  Colors
} from 'discord.js';
import ms from 'ms';
import Command, { properties, data } from '../../lib/structs/Command';
import { adequateHierarchy } from '../../lib/util/functions';

@data(
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the guild.')
    .setDefaultMemberPermissions(Permissions.KickMembers)
    .addUserOption(option => option.setName('user').setDescription('The user to ban.').setRequired(true))
    .addStringOption(option => option.setName('duration').setDescription('The duration of the ban.'))
    .addStringOption(option => option.setName('reason').setDescription('The reason for banning.').setMaxLength(3500))
    .addStringOption(option =>
      option
        .setName('delete-previous-messages')
        .setDescription('Delete messages sent in past...')
        .addChoices(
          { name: 'Previous hour', value: '1h' },
          { name: 'Previous 6 hours', value: '6h' },
          { name: 'Previous 12 hours', value: '12h' },
          { name: 'Previous 24 hours', value: '24h' },
          { name: 'Previous 3 days', value: '3d' },
          { name: 'Previous 7 days', value: '7d' }
        )
    )
)
@properties({
  clientPermissions: [Permissions.BanMembers]
})
class BanCommand extends Command {
  async run(interaction: ChatInputCommandInteraction<'cached'>) {
    const user = interaction.options.getUser('user', true);
    const member = interaction.options.getMember('user');

    if (user.id === interaction.user.id) throw 'You cannot ban yourself.';
    if (user.id === this.client.user!.id) throw 'You cannot ban me.';

    if (member) {
      if (!adequateHierarchy(interaction.member, member))
        throw 'You cannot ban this member due to inadequete hierarchy.';

      if (!adequateHierarchy(interaction.guild.members.me!, member))
        throw 'I cannot ban this member due to inadequete hierarchy.';
    }

    const reason = interaction.options.getString('reason') ?? 'Unspecified reason.';

    const durationStr = interaction.options.getString('duration');
    let duration = null;
    if (durationStr && durationStr !== 'never') {
      const unaryTest = +durationStr;
      if (unaryTest) duration = unaryTest * 1000;
      else duration = ms(durationStr) ?? null;

      if (!duration) throw 'Invalid duration.';
      duration = BigInt(duration);
    }
    if (duration && duration < 1000) throw 'Temporary ban duration must be at least 1 second.';

    const date = BigInt(Date.now());

    let expires = duration ? duration + date : null;
    const deleteMessageSeconds = Math.floor(
      ms(interaction.options.getString('delete-previous-messages') ?? '0s') / 1000
    );

    await interaction.deferReply();

    const guild = (await this.client.db.guild.findUnique({
      where: { id: interaction.guildId },
      select: { infractionModeratorPublic: true, infoBan: true, defaultBanDuration: true }
    }))!;

    if (!expires && durationStr !== 'never' && guild.defaultBanDuration !== 0n)
      expires = guild.defaultBanDuration + date;

    const infraction = await this.client.db.infraction.create({
      data: {
        userId: user.id,
        guildId: interaction.guildId,
        type: InfractionType.Ban,
        date,
        moderatorId: interaction.user.id,
        expires,
        reason
      }
    });

    if (expires) {
      const data = {
        guildId: interaction.guildId,
        userId: user.id,
        type: InfractionType.Ban,
        expires
      };

      await this.client.db.task.upsert({
        where: {
          userId_guildId_type: { userId: user.id, guildId: interaction.guildId, type: InfractionType.Ban }
        },
        update: data,
        create: data
      });
    }

    const { infractionModeratorPublic, infoBan } = guild;
    const expiresStr = Math.floor(Number(infraction.expires) / 1000);

    const dm = new EmbedBuilder()
      .setAuthor({ name: 'Parallel Moderation', iconURL: this.client.user!.displayAvatarURL() })
      .setTitle(`You were banned from ${interaction.guild.name}`)
      .setColor(Colors.Red)
      .setDescription(
        `${reason}${expires ? `\n\n***•** Expires: <t:${expiresStr}> (<t:${expiresStr}:R>)*` : ''}${
          infractionModeratorPublic ? `\n***•** Banned by ${interaction.member.toString()}*\n` : ''
        }`
      )
      .setFooter({ text: `Punishment ID: ${infraction.id}` })
      .setTimestamp();

    if (infoBan) dm.addFields([{ name: 'Additional Information', value: infoBan }]);

    if (member) await member.send({ embeds: [dm] }).catch(() => {});

    await interaction.guild.members.ban(user.id, { reason, deleteMessageSeconds });

    this.client.emit('punishLog', infraction);

    return interaction.editReply(`Banned **${user.username}** with ID \`${infraction.id}\``);
  }
}

export default BanCommand;
