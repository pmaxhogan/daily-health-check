import {Collection} from "@discordjs/collection";
import {Snowflake} from "discord-api-types";
import {OAuth2Guild, Client, Intents} from "discord.js";
import {Timestamp, Firestore} from '@google-cloud/firestore';
import {readFileSync} from "fs";

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MEMBERS] });

interface guildDoc{
    lastCheckedIn: Timestamp,
    something: number
}

const db = new Firestore({keyFilename: "serviceAccount.json"});


client.on("ready", async() => {
    console.log("Client ready");
    const result: Collection<Snowflake, OAuth2Guild> = await client.guilds.fetch();
    console.log(`Fetched ${result.size} guilds`);
    // noinspection ES6MissingAwait
    result.forEach(async guild => {
        const docRef = db.collection("guilds").doc(guild.id);
        const document = await docRef.get();

        let shouldRunCheckin = false;

        console.log(`Found doc for ${guild.id}: ${document.exists}`);

        if(document.exists) {
            const data = document.data() as guildDoc;

            const date = data.lastCheckedIn.toDate();

            console.log(`Doc last checked in ${date}`);

            if(date.toDateString() !== (new Date()).toDateString()){
                shouldRunCheckin = true;
            }
        }else{
            shouldRunCheckin = true;
        }

        if(shouldRunCheckin){
            console.log("Running checkin");

            await docRef.set({lastCheckedIn: Timestamp.fromDate(new Date())} as guildDoc);
        }else{
            console.log("Not running checkin");
        }
    });
});


// noinspection JSIgnoredPromiseFromCall
client.login(readFileSync("token.txt").toString().trim());
