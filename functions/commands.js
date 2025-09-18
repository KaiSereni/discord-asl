import 'dotenv/config';
import { InstallGlobalCommands } from './utils.js';

export const Commands = {
  HELP: 'help',
  LEARN: 'learn'
}

// Simple test command
const HELP_COMMAND = {
  name: Commands.HELP,
  description: 'Get help (we\'re not doing get help)',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

const LEARN_COMMAND = {
  name: Commands.LEARN,
  description: 'Use the bot!',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
};

// Command containing options
// const CHALLENGE_COMMAND = {
//   name: 'challenge',
//   description: 'Challenge to a match of rock paper scissors',
//   options: [
//     {
//       type: 3,
//       name: 'object',
//       description: 'Pick your object',
//       required: true,
//       choices: createCommandChoices(),
//     },
//   ],
//   type: 1,
//   integration_types: [0, 1],
//   contexts: [0, 2],
// };

const ALL_COMMANDS = [HELP_COMMAND, LEARN_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
console.log("Registration complete!");