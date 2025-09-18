import 'dotenv/config';

export async function DiscordRequest(endpoint, options) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);
  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-asl, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

export async function CreateChannel(guildId, options) {
  console.log(`Creating channel ${options.name} in ${guildId}`)
  // Endpoint per Discord docs: POST /guilds/{guild.id}/channels  [oai_citation:0‡Discord](https://discord.com/developers/docs/resources/channel?utm_source=chatgpt.com)
  const endpoint = `guilds/${guildId}/channels`;

  try {
    const res = await DiscordRequest(endpoint, {
      method: 'POST',
      body: options,
    });
    const channelData = await res.json();
    return channelData;
  } catch (err) {
    console.error('CreateChannel error:', err);
    throw err;
  }
}

export async function ModifyChannelPermissions(channel_id, overwrite_id, options) {
  const endpoint = `channels/${channel_id}/permissions/${overwrite_id}`
  console.log(endpoint)
  console.log(options)
  try {
    await DiscordRequest(endpoint, {
      method: 'PUT',
      body: options
    });
  }
  catch (e) {
    console.error(e);
  }
}

export async function SendToChannel(channel_id, content) {
  const endpoint = `channels/${channel_id}/messages`
  try {
    await DiscordRequest(endpoint, {
      method: 'POST',
      body: {
        "content": content
      }
    });
  }
  catch (e) {
    console.error(e);
  }
}