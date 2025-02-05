import { type ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits as Permissions } from 'discord.js';
import Command, { data } from '../../lib/structs/Command';
import { InfractionType } from '@prisma/client';
import ms from 'ms';
import { EscalationType, Escalations } from '../../types';

@data(
  new SlashCommandBuilder()
    .setName('escalations')
    .setDescription('Escalations allow you to punish members for reaching an amount of warnings.')
    .setDefaultMemberPermissions(Permissions.ManageGuild)
    .addSubcommand(cmd =>
      cmd
        .setName('add')
        .setDescription('Add an escalation to the list of escalations.')
        .addIntegerOption(opt =>
          opt
            .setName('amount')
            .setDescription('How many warnings the member has to accumulate before being punished.')
            .setMinValue(2)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Whether this is an escalation for automod warnings or for manual warnings.')
            .addChoices({ name: 'Manual', value: 'Manual' }, { name: 'AutoMod', value: 'AutoMod' })
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('punishment')
            .setDescription('The punishment to give for reaching `amount` warnings.')
            .addChoices(
              { name: 'Mute', value: InfractionType.Mute },
              { name: 'Kick', value: InfractionType.Kick },
              { name: 'Ban', value: InfractionType.Ban }
            )
            .setRequired(true)
        )
        .addStringOption(opt => opt.setName('duration').setDescription('The duration of the punishment'))
    )
    .addSubcommand(cmd =>
      cmd
        .setName('remove')
        .setDescription('Remove an escalation from the list of escalations.')
        .addIntegerOption(opt =>
          opt
            .setName('amount')
            .setDescription('How many warnings the member has to accumulate before being punished.')
            .setMinValue(2)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Whether this is an escalation for automod warnings or for manual warnings.')
            .addChoices({ name: 'Manual', value: 'Manual' }, { name: 'AutoMod', value: 'AutoMod' })
            .setRequired(true)
        )
    )
    .addSubcommand(cmd =>
      cmd
        .setName('view')
        .setDescription('View all escalations.')
        .addStringOption(opt =>
          opt
            .setName('type')
            .setDescription('Whether this is an escalation for automod warnings or for manual warnings.')
            .addChoices({ name: 'Manual', value: 'Manual' }, { name: 'AutoMod', value: 'AutoMod' })
            .setRequired(true)
        )
    )
)
class EscalationsCommand extends Command {
  async run(interaction: ChatInputCommandInteraction<'cached'>) {
    const subCmd = interaction.options.getSubcommand();
    const type = interaction.options.getString('type', true) as EscalationType;

    const guild = (await this.client.db.guild.findUnique({
      where: {
        id: interaction.guildId
      }
    }))!;

    const escalations = (type === 'Manual' ? guild.escalationsManual : guild.escalationsAutoMod) as Escalations;

    switch (subCmd) {
      case 'add': {
        const amount = interaction.options.getInteger('amount', true);
        const punishment = interaction.options.getString('punishment', true) as InfractionType;
        const uDuration = interaction.options.getString('duration');
        const duration = uDuration ? ms(uDuration) : null;
        if (duration === undefined) throw 'Invalid duration.';
        if (punishment === InfractionType.Mute && !duration) throw 'A duration is required for punishment `Mute`.';
        if (punishment === InfractionType.Kick && duration)
          throw 'A duration cannot be provided for punishment `Kick`.';

        if (escalations.some(e => e.amount === amount)) throw 'There is already an escalation for this amount.';

        await interaction.deferReply();

        type === 'Manual'
          ? await this.client.db.guild.update({
              where: { id: interaction.guildId },
              data: { escalationsManual: { push: { amount, duration: duration?.toString() ?? '0', punishment } } }
            })
          : await this.client.db.guild.update({
              where: { id: interaction.guildId },
              data: { escalationsAutoMod: { push: { amount, duration: duration?.toString() ?? '0', punishment } } }
            });

        return interaction.editReply(
          `Escalation added: ${punishment.toLowerCase()} a member${
            duration ? ` for ${ms(duration, { long: true })}` : ''
          } for having or exceeding ${amount} ${type.toLowerCase()} warnings.`
        );
      }
      case 'remove': {
        const amount = interaction.options.getInteger('amount', true);

        const escalation = escalations.find(e => e.amount === amount);
        if (!escalation) throw 'There is no escalation for this amount.';

        await interaction.deferReply();

        escalations.splice(escalations.indexOf(escalation), 1);

        type === 'Manual'
          ? await this.client.db.guild.update({
              where: { id: interaction.guildId },
              data: { escalationsManual: escalations }
            })
          : await this.client.db.guild.update({
              where: { id: interaction.guildId },
              data: { escalationsAutoMod: escalations }
            });

        return interaction.editReply(
          `Escalation removed: ${escalation.punishment.toLowerCase()} a member${
            escalation.duration !== '0' ? ` for ${ms(+escalation.duration, { long: true })}` : ''
          } for having or exceeding ${amount} ${type.toLowerCase()} warnings.`
        );
      }
      case 'view': {
        if (escalations.length === 0)
          return interaction.reply(`This guild has no ${type.toLowerCase()} escalations set up.`);

        const escalationsStr = escalations
          .sort((a, b) => a.amount - b.amount)
          .map(
            e =>
              `${e.amount} = ${e.punishment} ${
                e.duration !== '0' ? `for ${ms(Number(e.duration), { long: true })}` : ''
              }`
          )
          .join('\n');
        return interaction.reply(`Escalations for ${type.toLowerCase()} warnings:\`\`\`\n${escalationsStr}\`\`\``);
      }
    }
  }
}

export default EscalationsCommand;
