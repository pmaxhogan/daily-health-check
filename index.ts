import {Collection} from "@discordjs/collection";
import {Routes, Snowflake} from "discord-api-types/v9";
import {OAuth2Guild, Client, Intents, TextChannel, MessageOptions, Guild, Permissions} from "discord.js";
import {Timestamp, Firestore} from '@google-cloud/firestore';
import {readFileSync} from "fs";
const { REST } = require('@discordjs/rest');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MEMBERS] });

interface guildDoc{
    lastCheckedIn: Timestamp,
    channelId: Snowflake
}

const reactions = ["🔴", "🟠", "🟡", "🟢", "👍"];
const checkInterval = 1000 * 60 * 30;

const db = new Firestore({keyFilename: "serviceAccount.json"});
const token = readFileSync("token.txt").toString().trim();

const runHealthCheckForGuild = async (guild : OAuth2Guild | Guild, overrideDailyCheck?: boolean) => {
    const docRef = db.collection("guilds").doc(guild.id);
    const document = await docRef.get();

    console.log(`Found doc for ${guild.id}: ${document.exists}`);

    if(document.exists) {
        const data = document.data() as guildDoc;

        const date = data.lastCheckedIn && data.lastCheckedIn.toDate();

        console.log(`Doc last checked in ${date}`);

        const lateEnoughInDay = (new Date()).getHours() >= 5;

        const didNotCheckInToday = !date || date.toDateString() !== (new Date()).toDateString();

        if((didNotCheckInToday && lateEnoughInDay) || overrideDailyCheck){
            console.log("Running checkin");
            const thisGuild = client.guilds.cache.get(guild.id);

            if(!thisGuild) throw new TypeError("No guild found!");
            if(!data.channelId) throw new TypeError("No channel id found!");

            const channel = await thisGuild.channels.fetch(data.channelId) as TextChannel;

            const message:MessageOptions = {
                content: `@everyone Please complete your daily health checkin!\n\n(React with your current status)`,
                files: ["https://cdn.discordapp.com/attachments/878399508277497926/935192353478680586/mental-health-continuum-model.png"]
            };

            const sentMessage = await channel.send(message);

            for (const reaction of reactions) {
                await sentMessage.react(reaction);
            }

            await docRef.set({lastCheckedIn: Timestamp.fromDate(new Date())} as guildDoc, {merge: true});
        }else{
            console.log("Not running checkin");
        }
    }else{
        console.log(`Could not find document for guild ${guild.id}`);
    }
};

const checkForAllGuilds = async () => {
    const result: Collection<Snowflake, OAuth2Guild> = await client.guilds.fetch();
    console.log(`Fetched ${result.size} guilds`);
    // noinspection ES6MissingAwait
    result.forEach(async guild => {
        runHealthCheckForGuild(guild);
    });
};


let interval : number | null = null;
client.on("ready", async() => {
    console.log("Client ready");

    if(interval !== null){
        clearInterval(interval);
    }

    checkForAllGuilds();

    setInterval(checkForAllGuilds, checkInterval);
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "checkin") {
        if(interaction.guild) {
            await interaction.deferReply({ephemeral: true});

            if(interaction.memberPermissions && interaction.memberPermissions.has(Permissions.FLAGS.MENTION_EVERYONE)) {
                await runHealthCheckForGuild(interaction.guild, true);
            }
            await interaction.editReply({content: "👍"});
        }else{
            await interaction.reply({ephemeral: true, content: "Please run this command in a server text channel."});
        }
    }
});


// noinspection JSIgnoredPromiseFromCall
client.login(token);

const commands = [{
    name: "checkin",
    description: "(Manually) runs the daily health checkin for this server"
}];

const rest = new REST({ version: "9" }).setToken(token);

(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands("939986851593355294", "340940153424052225"),
            { body: commands },
        );

        console.log("Successfully reloaded slash commands.");
    } catch (error) {
        console.error(error);
    }
})();
