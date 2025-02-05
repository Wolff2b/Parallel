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
const d28 = ms('28d');

@data(
  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a member.')
    .setDefaultMemberPermissions(Permissions.ModerateMembers)
    .addUserOption(option => option.setName('member').setDescription('The member to mute.').setRequired(true))
    .addStringOption(option =>
      option
        .setName('duration')
        .setDescription('The duration of the mute. Required unless a default mute duration is set!')
    )
    .addStringOption(option => option.setName('reason').setDescription('The reason for the mute.').setMaxLength(3500))
)
@properties({
  clientPermissions: [Permissions.ModerateMembers]
})
class MuteCommand extends Command {
  async run(interaction: ChatInputCommandInteraction<'cached'>) {
    const member = interaction.options.getMember('member');
    if (!member) throw 'The provided user is not in this guild.';
    if (member.id === interaction.user.id) throw 'You cannot mute yourself.';
    if (member.id === this.client.user!.id) throw 'You cannot mute me.';

    if (!adequateHierarchy(interaction.member, member))
      throw 'You cannot mute this member due to inadequete hierarchy.';

    if (!adequateHierarchy(interaction.guild.members.me!, member))
      throw 'I cannot mute this member due to inadequete hierarchy.';

    if (member.permissions.has(Permissions.Administrator)) throw 'You cannot mute an administrator.';

    const reason = interaction.options.getString('reason') ?? 'Unspecified reason.';

    const durationStr = interaction.options.getString('duration');
    let duration = null;
    if (durationStr) {
      const unaryTest = +durationStr;
      if (unaryTest) duration = unaryTest * 1000;
      else duration = ms(durationStr) ?? null;

      if (!duration) throw 'Invalid duration.';
      duration = BigInt(duration);
    }
    if (duration) {
      if (duration < 1000) throw 'Mute duration must be at least 1 second.';
      if (duration > d28) throw 'Mute duration can only be as long as 28 days.';
    }

    const date = BigInt(Date.now());

    let expires = duration ? duration + date : null;

    const guild = (await this.client.db.guild.findUnique({
      where: { id: interaction.guildId },
      select: { infractionModeratorPublic: true, infoMute: true, defaultMuteDuration: true }
    }))!;

    if (!expires && guild.defaultMuteDuration === 0n) throw 'A mute duration is required since a default is not set.';

    await interaction.deferReply();

    if (!expires) {
      expires = guild.defaultMuteDuration + date;
      duration = guild.defaultMuteDuration;
    }

    await member.timeout(Number(duration), reason);

    const infraction = await this.client.db.infraction.create({
      data: {
        userId: member.id,
        guildId: interaction.guildId,
        type: InfractionType.Mute,
        date,
        moderatorId: interaction.user.id,
        expires,
        reason
      }
    });

    const data = {
      guildId: interaction.guildId,
      userId: member.id,
      type: InfractionType.Mute,
      expires
    };

    await this.client.db.task.upsert({
      where: { userId_guildId_type: { userId: member.id, guildId: interaction.guildId, type: InfractionType.Mute } },
      update: data,
      create: data
    });

    const { infractionModeratorPublic, infoMute } = guild;
    const expiresStr = Math.floor(Number(infraction.expires) / 1000);

    const dm = new EmbedBuilder()
      .setAuthor({ name: 'Parallel Moderation', iconURL: this.client.user!.displayAvatarURL() })
      .setTitle(`You were muted in ${interaction.guild.name}`)
      .setColor(Colors.Yellow)
      .setDescription(
        `${reason}${expires ? `\n\n***•** Expires: <t:${expiresStr}> (<t:${expiresStr}:R>)*` : ''}${
          infractionModeratorPublic ? `\n***•** Muted by ${interaction.member.toString()}*\n` : ''
        }`
      )
      .setFooter({ text: `Punishment ID: ${infraction.id}` })
      .setTimestamp();

    if (infoMute) dm.addFields([{ name: 'Additional Information', value: infoMute }]);

    await member.send({ embeds: [dm] }).catch(() => {});

    this.client.emit('punishLog', infraction);

    return interaction.editReply(`Muted **${member.user.username}** with ID \`${infraction.id}\``);
  }
}

export default MuteCommand;
