import {Collection} from "@discordjs/collection";
import {Snowflake} from "discord-api-types";
import {OAuth2Guild, Client, Intents} from "discord.js";
import {Firestore, Timestamp} from '@google-cloud/firestore';
import {initializeApp, credential} from "firebase-admin";
import {readFileSync} from "fs";

const serviceAccount = require("serviceAccount.json");

initializeApp({
    credential: credential.cert(serviceAccount)
});

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Intents.FLAGS.GUILD_MEMBERS] });

const firestore = new Firestore();

interface guildDoc{
    lastCheckedIn: Timestamp
}

client.on("ready", async() => {
    console.log("Client ready");
    const result: Collection<Snowflake, OAuth2Guild> = await client.guilds.fetch();
    console.log(`Fetched ${result.size} guilds`);
    // noinspection ES6MissingAwait
    result.forEach(async guild => {
        const docRef = firestore.doc("guilds/" + guild.id);
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
            console.log("running checkin");

            await docRef.set({lastCheckedIn: Timestamp.fromDate(new Date())} as guildDoc);
        }
    });
});


// noinspection JSIgnoredPromiseFromCall
client.login(readFileSync("token.txt").toString().trim());
