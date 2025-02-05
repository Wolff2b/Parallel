import { Colors, EmbedBuilder, Message } from 'discord.js';
import Command, { properties } from '../../lib/structs/Command';
import { mainColor } from '../../lib/util/constants';
import ms from 'ms';

@properties<true>({
  name: 'help',
  description: 'Get a list of all commands or get help on a certain command.',
  args: ['<command>'],
  allowDM: true
})
class HelpCommand extends Command {
  async run(message: Message, args: string[]) {
    if (args.length > 0) {
      const commandName = args[0];
      const command =
        this.client.commands.message.get(commandName) ??
        this.client.commands.message.get(this.client.aliases.get(commandName) as string);

      const prefix = message.inGuild()
        ? (await this.client.db.guild.findUnique({ where: { id: message.guildId }, select: { prefix: true } }))!.prefix
        : process.env.PREFIX!;

      if (!command) {
        // check for shortcut
        if (!message.inGuild()) throw 'No command with that name or alias exists.';
        const shortcut = await this.client.db.shortcut.findUnique({
          where: {
            guildId_name: { guildId: message.guildId, name: commandName }
          }
        });

        if (!shortcut) throw 'No command with that name or alias exists.';

        const embed = new EmbedBuilder()
          .setAuthor({ name: 'Parallel', iconURL: this.client.user!.displayAvatarURL() })
          .setTitle(shortcut.name)
          .setColor(mainColor)
          .setDescription(
            `${shortcut.description}\n\nThis command will \`${shortcut.punishment.toLowerCase()}\` the provided user${
              shortcut.duration ? ` for \`${ms(Number(shortcut.duration), { long: true })}\`` : ''
            }${
              shortcut.deleteTime
                ? ` and purge messages by them up to \`${ms(shortcut.deleteTime * 1000, { long: true })}\` old`
                : ''
            }.`
          );

        return message.reply({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: 'Parallel', iconURL: this.client.user!.displayAvatarURL() })
        .setTitle(command.name)
        .setColor(!command.NA ? mainColor : Colors.Red);

      let description = `${command.description}\n\n`;
      if (command.NA) description += '***• This command is only available via slash commands!***\n';
      if (command.args)
        description += `**•** *Usage: \`${command.args.map(way => `${prefix}${command.name} ${way}`).join('\n')}\`*\n`;
      if (command.aliases.length > 0)
        description += `**•** *Aliases: ${command.aliases.map(alias => `\`${alias}\``).join(', ')}*\n`;
      if (command.allowDM) description += `**•** *This command can be ran in DM's.*`;

      embed.setDescription(description);

      return message.reply({ embeds: [embed] });
    }

    const shortcuts = message.inGuild()
      ? (await this.client.db.shortcut.findMany({ where: { guildId: message.guildId } }))!
      : null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Parallel', iconURL: this.client.user!.displayAvatarURL() })
      .setTitle('Command List')
      .setColor(mainColor)
      .setDescription(
        [...this.client.commands.message.values()]
          .map(cmd => `${cmd.NA ? '~~' : ''}\`${cmd.name}\`${cmd.NA ? '~~' : ''}`)
          .join(', ')
      );

    if (shortcuts && shortcuts.length !== 0)
      embed.addFields({
        name: 'Shortcuts',
        value: shortcuts.map(shortcut => `\`${shortcut.name}\``).join(', ')
      });

    return message.reply({ embeds: [embed] });
  }
}

export default HelpCommand;
