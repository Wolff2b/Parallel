import { InfractionType as IT } from '@prisma/client';
import { ChatInputCommandInteraction, Colors, EmbedBuilder, GuildMember } from 'discord.js';
import Listener from '../lib/structs/Listener';
import { pastTenseInfractionTypes } from '../lib/util/constants';
import { adequateHierarchy } from '../lib/util/functions';

class CustomCommandListener extends Listener {
  constructor() {
    super('customCommand');
  }

  async run(interaction: ChatInputCommandInteraction<'cached'>) {
    const command = await this.client.db.shortcut.findUnique({
      where: {
        guildId_name: { guildId: interaction.guildId, name: interaction.commandName }
      }
    });

    if (!command) return interaction.reply({ content: 'Unknown Command.', ephemeral: true });

    const target =
      command.punishment === IT.Ban || command.punishment === IT.Unban
        ? interaction.options.getUser('user')
        : interaction.options.getMember('member');

    if (!target) return interaction.reply({ content: 'The provided user is not in this guild.', ephemeral: true });

    const { punishment, reason, duration, deleteTime } = command;
    const date = BigInt(Date.now());
    const expires = duration ? date + duration : null;
    const expiresStr = expires ? Math.floor(Number(expires) / 1000) : null;
    const lpunishment = punishment.toLowerCase();

    if (punishment === IT.Unban && !(await interaction.guild.bans.fetch(target.id).catch(() => null)))
      return interaction.reply({ content: 'That user is not banned.', ephemeral: true });

    if (target.id === interaction.user.id)
      return interaction.reply({ content: `You cannot ${lpunishment} yourself.`, ephemeral: true });
    if (target.id === this.client.user!.id)
      return interaction.reply({ content: `You cannot ${lpunishment} me.`, ephemeral: true });

    if (target instanceof GuildMember && !adequateHierarchy(interaction.member, target))
      return interaction.reply({
        content: `You cannot ${lpunishment} this member due to inadequete hierarchy.`,
        ephemeral: true
      });

    if (target instanceof GuildMember && !adequateHierarchy(interaction.guild.members.me!, target))
      return interaction.reply({
        content: `I cannot ${lpunishment} this member due to inadequete hierarchy.`,
        ephemeral: true
      });

    await interaction.deferReply();

    const infraction = await this.client.db.infraction.create({
      data: {
        guildId: interaction.guildId,
        userId: target.id,
        type: punishment,
        date,
        moderatorId: interaction.user.id,
        expires,
        reason
      },
      include: {
        guild: {
          select: { infractionModeratorPublic: true, infoBan: true, infoKick: true, infoMute: true, infoWarn: true }
        }
      }
    });

    if (expires) {
      const data = {
        guildId: interaction.guildId,
        userId: target.id,
        type: punishment,
        expires
      };

      await this.client.db.task.upsert({
        where: {
          userId_guildId_type: { userId: target.id, guildId: interaction.guildId, type: punishment }
        },
        update: data,
        create: data
      });
    }

    const { infoBan, infoKick, infoMute, infoWarn } = infraction.guild;

    const dm = new EmbedBuilder()
      .setAuthor({ name: 'Parallel Moderation', iconURL: this.client.user!.displayAvatarURL() })
      .setTitle(
        `You were ${pastTenseInfractionTypes[lpunishment as keyof typeof pastTenseInfractionTypes]} ${
          punishment === IT.Ban || punishment === IT.Kick ? 'from' : 'in'
        } ${interaction.guild.name}`
      )
      .setColor(
        punishment === IT.Warn
          ? Colors.Yellow
          : punishment === IT.Mute || punishment === IT.Kick
          ? Colors.Orange
          : punishment === IT.Unmute || punishment === IT.Unban
          ? Colors.Green
          : Colors.Red
      )
      .setDescription(`${reason}${expires ? `\n\n***•** Expires: <t:${expiresStr}> (<t:${expiresStr}:R>)*` : ''}`)
      .setFooter({ text: `Punishment ID: ${infraction.id}` })
      .setTimestamp();

    switch (punishment) {
      case IT.Ban:
        if (infoBan) dm.addFields([{ name: 'Additional Information', value: infoBan }]);
      case IT.Kick:
        if (infoKick) dm.addFields([{ name: 'Additional Information', value: infoKick }]);
      case IT.Mute:
        if (infoMute) dm.addFields([{ name: 'Additional Information', value: infoMute }]);
      case IT.Warn:
        if (infoWarn) dm.addFields([{ name: 'Additional Information', value: infoWarn }]);
    }

    if (target instanceof GuildMember) await target!.send({ embeds: [dm] }).catch(() => {});

    this.client.emit('punishLog', infraction);

    switch (punishment) {
      case IT.Ban:
        await interaction.guild.members.ban(target.id, { reason, deleteMessageSeconds: deleteTime ?? undefined });
      case IT.Kick:
        await interaction.guild.members.kick(target.id, reason);
      case IT.Mute:
        await (target as GuildMember).timeout(Number(duration), reason);
    }

    const tense = pastTenseInfractionTypes[lpunishment as keyof typeof pastTenseInfractionTypes];
    const upperTense = tense[0].toUpperCase() + tense.slice(1);

    return interaction.editReply(
      `${upperTense} **${target instanceof GuildMember ? target.user.tag : target.tag}** with ID \`${infraction.id}\``
    );
  }
}

export default CustomCommandListener;
