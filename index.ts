import {Collection} from "@discordjs/collection";
import {Snowflake} from "discord-api-types";
import {OAuth2Guild, Client, Intents, TextChannel, MessageOptions} from "discord.js";
import {Timestamp, Firestore} from '@google-cloud/firestore';
import {readFileSync} from "fs";

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MEMBERS] });

interface guildDoc{
    lastCheckedIn: Timestamp,
    channelId: Snowflake
}

const db = new Firestore({keyFilename: "serviceAccount.json"});

const reactions = ["🔴", "🟠", "🟡", "🟢", "👍"];

client.on("ready", async() => {
    console.log("Client ready");
    const result: Collection<Snowflake, OAuth2Guild> = await client.guilds.fetch();
    console.log(`Fetched ${result.size} guilds`);
    // noinspection ES6MissingAwait
    result.forEach(async guild => {
        const docRef = db.collection("guilds").doc(guild.id);
        const document = await docRef.get();


        console.log(`Found doc for ${guild.id}: ${document.exists}`);

        if(document.exists) {
            const data = document.data() as guildDoc;

            const date = data.lastCheckedIn && data.lastCheckedIn.toDate();

            console.log(`Doc last checked in ${date}`);

            if(!date || date.toDateString() !== (new Date()).toDateString()){
                console.log("Running checkin");
                const thisGuild = client.guilds.cache.get(guild.id);

                if(!thisGuild) throw new TypeError("No guild found!");
                if(!data.channelId) throw new TypeError("No channel id found!");

                const channel = await thisGuild.channels.fetch(data.channelId) as TextChannel;


                const message:MessageOptions = {
                    content: `@everyone Please complete your daily health checkin!\nReact with your current status`,
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
    });
});


// noinspection JSIgnoredPromiseFromCall
client.login(readFileSync("token.txt").toString().trim());
