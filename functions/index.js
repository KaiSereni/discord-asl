import { onRequest } from 'firebase-functions/https';
import {
  ButtonStyleTypes,
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType,
  MessageComponentTypes,
  verifyKey
} from 'discord-interactions';
import { config } from 'dotenv'
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from "firebase-admin/firestore";
import { Commands } from './commands.js';
import { CreateChannel, ModifyChannelPermissions, SendToChannel } from './utils.js';


config();
initializeApp();
const db = getFirestore();
const usersCollection = db.collection('users');

const USER_CHANNEL_PARENT = "1417636696090087504"
// const docRef = usersCollection.doc('alovelace');

// await docRef.set({
//   first: 'Ada',
//   last: 'Lovelace',
//   born: 1815
// });

// const snapshot = await db.collection('users').get();
// snapshot.forEach((doc) => {
//   console.log(doc.id, '=>', doc.data()); // alovelace => { first: 'Ada', last: 'Lovelace', born: 1815 }
// });

export const interactions = onRequest(async (req, res) => {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const rawBody = req.rawBody;
  const keyValid = await verifyKey(rawBody, signature, timestamp, process.env.PUBLIC_KEY)
  if (!keyValid) {
    return res.status(400).json({ error: 'unauthenticated' });
  }

  const { type, member, guild_id, channel, data } = req.body;
  const name = data.name
  const cid = channel.id
  const uid = member.user.id;
  const username = member.user.global_name

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {

    if (name == Commands.LEARN) {
      const userDocRef = usersCollection.doc(uid.toString());
      var userChannelId;
      var userData;
      if (!(await userDocRef.get()).exists) {
        const newUserChannel = await CreateChannel(guild_id, {
          name: `${username}'s channel`,
          type: 0,
          topic: `Created for user ${uid}`,
          parent_id: USER_CHANNEL_PARENT
        })
        userDocRef.set({
          "progress": {
            "syntax": 0,
            "numerals": 0,
            "statements": 0,
            "questions": 0,
            "conversations": 0
          },
          "status": -1,
          "channel": newUserChannel.id,
          "last_interaction": Date.now(),
          "active_module": 0
        })
        userChannelId = newUserChannel.id
        await ModifyChannelPermissions(userChannelId, guild_id, {
          deny: (0x400).toString(),
          type: 0
        })
        await ModifyChannelPermissions(userChannelId, uid, {
          allow: (0x400 | 0x800).toString(),
          type: 1
        })
        res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: "Hello!",
                fields: [
                  { name: "Type /learn in your personal channel to get started!", value: `<#${userChannelId}>`, inline: true }
                ]
              }
            ]
          }
        });
        SendToChannel(userChannelId, `Welcome to your channel, <@${uid}>`)
        userData = (await userDocRef.get()).data();
      }
      else {
        userData = (await userDocRef.get()).data();
        userChannelId = userData.channel;
      }

      var userProgress = userData.progress
      var userStatus = userData.status
      var lastInteraction = userData.last_interaction
      var activeModule = userData.active_module
      // userChannelId = userData.channel

      if (cid !== userChannelId) {
        return
      }
      else {
        // MAIN LEARNING SECTION
        // If last_interaction was more than 10 minutes ago, set status to -1
        // If status = -1: show the user a list of available modules
        // If status = 0, they have started module `active_module`
        // If status > 0, they are on question `status` of `active_module`
        // TODO: do this
        return res.send(({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            embeds: [
              {
                title: "",
                fields: [
                  { name: "", value: ``, inline: true }
                ]
              }
            ]
          }
        }));
      }
    }

    if (name === Commands.HELP) {
      const userDocRef = usersCollection.doc(uid.toString())
      const userDoc = await userDocRef.get()
      if (userDoc.exists) {
        const progress = userDoc.data()["progress"]
        const joinTime = userDoc.createTime.toDate()
        const getAge = (timestamp) => Math.ceil((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
        const level = Object.values(progress).reduce((partialSum, a) => partialSum + a, 0);
        console.log(level)
        var yourProgressMessage = `Hello again, <@${uid}>. Here's some information about your progress: \n✨ Your XP level: ${level}\n⏲ You have been learning for ${getAge(joinTime)} days.`
      }
      else {
        var yourProgressMessage = `Welcome, <@${uid}>. If you decide to start learning ASL, this section will display your XP level, your progress, and the amount of time you've been learning!`
      }
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: "ASL Bot Info",
              fields: [
                { name: "About this Bot", value: "This bot aims to help you learn sign language quickly, prioritizing making you conversational enough to communicate. The course is designed to be used a few times a week, for 5-10 minutes per session.", inline: false },
                { name: "Your Progress", value: yourProgressMessage, inline: true },
                { name: "Quick Start", value: "To get started, type `/learn`.", inline: true }
              ]
            }
          ]
        }
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});