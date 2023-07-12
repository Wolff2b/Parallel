import { Message } from 'discord.js';
import Command, { properties } from '../../lib/structs/Command';

@properties<true>({
  name: 'automod',
  description: 'Manage the automod configuration.',
  NA: true
})
class ConfigCommand extends Command {
  async run(message: Message<true>) {
    return message.reply('Due to the complexity of this command, it is only available via slash commands.');
  }
}

export default ConfigCommand;
