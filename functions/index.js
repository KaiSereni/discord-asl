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

// This is for local testing. In production, Firebase handles environment variables.
config();

export const interactions = onRequest(async (req, res) => {
  const signature = req.get('X-Signature-Ed25519');
  const timestamp = req.get('X-Signature-Timestamp');
  const rawBody = req.rawBody;
  const keyValid = await verifyKey(rawBody, signature, timestamp, process.env.PUBLIC_KEY)
  if (!keyValid) {
    return res.status(400).json({ error: 'unauthenticated' });
  }

  const { id, type, data } = req.body;

  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    if (name === 'test') {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          flags: InteractionResponseFlags.IS_COMPONENTS_V2,
          components: [
            {
              type: MessageComponentTypes.TEXT_DISPLAY,
              content: `hello world`
            }
          ]
        },
      });
    }

    console.error(`unknown command: ${name}`);
    return res.status(400).json({ error: 'unknown command' });
  }

  console.error('unknown interaction type', type);
  return res.status(400).json({ error: 'unknown interaction type' });
});