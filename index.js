require('dotenv').config();
const config = require('./config.json');
const { Client, MessageEmbed } = require('discord.js');
const mongoose = require('mongoose');
const logs = require('./schemas/logs')

const db = mongoose.connect(process.env.db);
const client = new Client({ intents: ["DIRECT_MESSAGES", "GUILDS", "GUILD_BANS", "GUILD_MEMBERS", "GUILD_MESSAGES", "AUTO_MODERATION_EXECUTION", "AUTO_MODERATION_CONFIGURATION"] });

db.then(async() => {
    console.log('Connected to Database');
    if (config.logs.guild.length > 1 && config.logs.logChannel > 1) {
        const guild = await client.guilds.fetch(config.logs.guild)
        const channel = await guild.channels.fetch(config.logs.logChannel)
        console.log(channel);
        if (!channel) throw new Error('Der Server konnte keinen Channel finden.');

        if (config.logs.active) {
            channel.send({
                embeds: [
                    new MessageEmbed()
                        .setTitle('Logs > Database')
                        .setDescription(`> Database connection found!`)
                        .setColor('GREEN')
                        .setAuthor({ name: client.user.username, iconURL: client.user.avatarURL() })
                ]
            })
        } else return;
    };
});

client.on('ready', async () => {
    if (config.logs.guild.length > 1 && config.logs.logChannel > 1) {
        const guild = client.guilds.cache.get(config.logs.guild);
        const channel = guild.channels.cache.find((oChannel) => oChannel.id === config.logs.logChannel);

        if (!channel) throw new Error('Der Server konnte keinen Channel finden.');

        if (config.logs.active) {
            channel.send({
                embeds: [
                    new MessageEmbed()
                        .setTitle('Logs > Client')
                        .setDescription(`> Client connected to Discord with the identifier ${client.user.id}!`)
                        .setColor('GREEN')
                        .setAuthor({ name: client.user.username, iconURL: client.user.avatarURL() })
                ]
            })
        } else return;
    };

    console.log('Client is ready!')
});

let messages = [];

setInterval(() => {
    const users = messages.map(x => x.discordId);
    const userMessages = [];

    users.forEach(user => {
        const msgs = messages.find(x => x.discordId === user);
        if (userMessages.find(y => y.discordId === user)) return;
        userMessages.push({ discordId: user, msgs: msgs.length });
    });

    userMessages.forEach(msgs => {
        const data = messages.filter(element => element.discordId === msgs.discordId);

        let time = Math.max(...data.map(x => x.time)) - new Date().getTime();
        time = Number(time.toString().split('-')[1]);

        if (time > config.antispam.time_between_actions) {
            messages = messages.filter(element => element.discordId !== msgs.discordId)
        };
    });
}, 1)

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    messages.push({
        discordId: message.author.id,
        time: new Date().getTime()
    });

    if (messages.find((oMessage) => oMessage.discordId === message.author.id)) {
        const data = messages.filter(msg => msg.discordId === message.author.id);

        if (data.length > config.antispam.maxMessages) {
            message.delete();

            switch (config.antispam.type) {
                case 'kick':
                    if (message.member.kickable) {
                        message.member.kick();
                        await logs.create({
                            discordId: message.guildId,
                            title: 'Gekickt wegen Spam!',
                            description: `${message.author.tag} - ${message.author.id} wurde wegen spams gekickt.`,
                            attachments: [messages.filter(file => file.discordId === message.author.id)]
                        }).then(async () => {
                            await sendLogMessage('Gekickt wegen Spam!', `${message.author.tag} - ${message.author.id} wurde wegen spams gekickt.`);
                        });
                    } else {
                        const created = await logs.create({
                            discordId: message.guildId,
                            title: 'Spieler konnte nicht gekickt werden',
                            description: `${message.author.tag} - ${message.author.id} konnte nicht gekickt werden, da der Bot keine Berechtigungen dazu hat.`,
                            attachments: [messages.filter(file => file.discordId === message.author.id)]
                        }).then(async () => {
                            await sendLogMessage('Spieler konnte nicht gekickt werden',`${message.author.tag} - ${message.author.id} konnte nicht gekickt werden, da der Bot keine Berechtigungen dazu hat.`,);
                        });
                    }
                    break;
                case 'warn':
                    await logs.create({
                        discordId: message.guildId,
                        title: 'Gewarnt wegen spam',
                        description: `${message.author.tag} - ${message.author.id} wurde wegen spams gewarnt.`,
                        attachments: [messages.filter(file => file.discordId === message.author.id)],
                        warn: { discordId: message.author.id, reason: 'spam' }
                    }).then(async () => {
                        await sendLogMessage('Gewarnt wegen Spam!', `${message.author.tag} - ${message.author.id} wurde wegen spams gewarnt.`);
                    });

                    const gLogs = await logs.find({ discordId: message.guildId });
                    const warns = gLogs.filter(y => y.warn && y.warn.discordId === message.author.id).map(x => x);

                    if (warns.length > config.warnSystem.maxWarns) {
                        if (message.member.kickable) {
                            message.member.kick();
                            await logs.create({
                                discordId: message.guildId,
                                title: 'Gekickt wegen Spam!',
                                description: `${message.author.tag} - ${message.author.id} wurde wegen spams gekickt.`,
                                attachments: [messages.filter(file => file.discordId === message.author.id)]
                            }).then(async () => {
                                await sendLogMessage('Gekickt wegen Spam!', `${message.author.tag} - ${message.author.id} wurde wegen spams gekickt.`);
                            });
                        } else {
                            const created = await logs.create({
                                discordId: message.guildId,
                                title: 'Spieler konnte nicht gekickt werden',
                                description: `${message.author.tag} - ${message.author.id} konnte nicht gekickt werden, da der Bot keine Berechtigungen dazu hat.`,
                                attachments: [messages.filter(file => file.discordId === message.author.id)]
                            }).then(async () => {
                                await sendLogMessage(created.title, created.description);
                            });
                        }
                    }
                    break;
                case 'ban':
                    if (message.member.bannable) {
                        message.member.ban({ reason: 'Spam!' });
                        await logs.create({
                            discordId: message.guildId,
                            title: 'Gebant wegen Spam!',
                            description: `${message.author.tag} - ${message.author.id} wurde wegen spams gebant.`,
                            attachments: [messages.filter(file => file.discordId === message.author.id)]
                        }).then(async () => {
                            await sendLogMessage('Gekickt wegen Spam!', `${message.author.tag} - ${message.author.id} wurde wegen spams gebant.`);
                        });
                    } else {
                        const created = await logs.create({
                            discordId: message.guildId,
                            title: 'Spieler konnte nicht gebant werden',
                            description: `${message.author.tag} - ${message.author.id} konnte nicht gebant werden, da der Bot keine Berechtigungen dazu hat.`,
                            attachments: [messages.filter(file => file.discordId === message.author.id)]
                        }).then(async () => {
                            await sendLogMessage(created.title, created.description);
                        });
                    }
                    break;
            }
        }
    }
});

async function sendLogMessage(title, description) {
    const guild = client.guilds.cache.get(config.logs.guild);
    const channel = guild.channels.cache.find((oChannel) => oChannel.id === config.logs.logChannel);

    if (!channel) throw new Error('Der Server konnte keinen Channel finden.');

    if (config.logs.active) {
        await channel.send({
            embeds: [
                new MessageEmbed()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor('BLURPLE')
                    .setAuthor({ name: client.user.username, iconURL: client.user.avatarURL() })
            ]
        })
    } else return;
}


client.login(process.env.token)