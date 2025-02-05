import { Client as DJSClient, IntentsBitField as Intents, Options, Partials, Sweepers } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { createPrismaRedisCache } from 'prisma-redis-middleware';
import fs from 'fs';
import type Command from './Command';
import type Listener from './Listener';
import type Modal from './Modal';
import Button from './Button';

class Client extends DJSClient {
  public db = new PrismaClient();
  public commands: {
    slash: Map<string, Command>;
    message: Map<string, Command<true>>;
  } = {
    slash: new Map(),
    message: new Map()
  };
  public aliases: Map<string, string> = new Map();

  public modals: Map<string, Modal> = new Map();
  public buttons: Map<string, Button> = new Map();

  constructor() {
    super({
      intents: [
        Intents.Flags.Guilds,
        Intents.Flags.GuildMembers,
        Intents.Flags.GuildMessages,
        Intents.Flags.MessageContent,
        Intents.Flags.DirectMessages
      ],
      partials: [Partials.Message, Partials.Channel],
      makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        ReactionManager: 0,
        GuildEmojiManager: 0,
        GuildStickerManager: 0,
        VoiceStateManager: 0,
        GuildInviteManager: 0,
        GuildScheduledEventManager: 0
      }),
      sweepers: {
        ...Options.DefaultSweeperSettings,
        guildMembers: {
          interval: 300,
          filter: Sweepers.filterByLifetime({
            lifetime: 900,
            excludeFromSweep: member => member.id !== process.env.CLIENT_ID
          })
        }
      },
      allowedMentions: {
        parse: []
      }
    });
  }

  async _cacheModals() {
    const files = fs.readdirSync('src/modals');
    for (const file of files) {
      const modalClass = (await import(`../../modals/${file.slice(0, -3)}`)).default;
      const modalInstant: Modal = new modalClass();
      this.modals.set(modalInstant.name, modalInstant);
    }
  }

  async _cacheButtons() {
    const files = fs.readdirSync('src/buttons');
    for (const file of files) {
      const buttonClass = (await import(`../../buttons/${file.slice(0, -3)}`)).default;
      const buttonInstant: Button = new buttonClass();
      this.buttons.set(buttonInstant.name, buttonInstant);
    }
  }

  async _cacheSlashCommands() {
    const files = fs.readdirSync(`src/commands/slash`);
    for (const file of files) {
      const cmdClass = (await import(`../../commands/slash/${file.slice(0, -3)}`)).default;
      const cmdInstant: Command = new cmdClass();
      this.commands.slash.set(cmdInstant.data.name!, cmdInstant);
    }
  }

  async _cacheMessageCommands() {
    const files = fs.readdirSync(`src/commands/message`);
    for (const file of files) {
      const cmdClass = (await import(`../../commands/message/${file.slice(0, -3)}`)).default;
      const cmdInstant: Command<true> = new cmdClass();
      this.commands.message.set(cmdInstant.name!, cmdInstant);

      cmdInstant.aliases.forEach(alias => this.aliases.set(alias, cmdInstant.name!));
    }
  }

  async _loadListeners() {
    const files = fs.readdirSync('src/listeners');
    for (const file of files) {
      const listenerClass = (await import(`../../listeners/${file.slice(0, -3)}`)).default;
      const listenerInstant: Listener = new listenerClass();
      listenerInstant.once
        ? this.once(listenerInstant.name, (...args) => void listenerInstant.run(...args))
        : this.on(listenerInstant.name, (...args) => void listenerInstant.run(...args));
    }
  }

  override async login(token: string) {
    await this._cacheSlashCommands();
    await this._cacheMessageCommands();
    await this._cacheModals();
    await this._cacheButtons();
    await this._loadListeners();

    this.db.$use(
      createPrismaRedisCache({
        storage: {
          type: 'memory',
          options: {
            invalidation: true
          }
        },
        cacheTime: 600000
      })
    );
    await this.db.$connect();

    return super.login(token);
  }
}

export default Client;
