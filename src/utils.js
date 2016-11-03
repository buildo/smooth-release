import { execSync } from 'child_process';
import status from 'node-status';
import Octokat from 'octokat';
import console from 'better-console';
// import readline from 'readline';
// import inquirer from 'inquirer';
import { startsWith, every } from 'lodash';
import config from './config';

// CUSTOM ERROR

export function CustomError(message) {
  this.name = 'CustomError';
  this.message = message || '';
  const error = new Error(this.message);
  error.name = this.name;
  this.stack = error.stack;
}
CustomError.prototype = Object.create(Error.prototype);


// LOGS

export const log = console.log;
export const info = console.info;
export const warning = console.warn;
export const error = console.error;
export const title = title => (
  warning(`\n${title.toUpperCase()}\n${title.split('').map(() => '-').join('')}\n`)
);

export const onError = e => {
  status.stop();
  if (e instanceof CustomError) {
    error(`\nError: ${e.message}\n`);
  } else {
    error('\n', e.stack);
  }
  process.exit(1);
};


// UTILS

export const getCurrentBranch = () => execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

export const isVersionTag = tag => (
  startsWith(tag.name, 'v') && every(tag.name.slice(1).split('.'), s => typeof parseInt(s) === 'number')
);

export const getRootFolderPath = () => execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();


// OCTOKAT

export const getGithubOwnerAndRepo = () => {
  const remoteOriginUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();

  const [owner, repo] = remoteOriginUrl.slice(startsWith(remoteOriginUrl, 'https') ? 19 : 15, remoteOriginUrl.length - 4).split('/');

  return { owner, repo };
};

const octokat = config.github.token ? new Octokat({ token: config.github.token }) : new Octokat();

const { owner, repo } = getGithubOwnerAndRepo();
export const github = octokat.repos(`${owner}/${repo}`);


// RL INTERFACE

// function rlinterface() {
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
//   });
//   return {
//     confirmation: (message) => new Promise(resolve => {
//       rl.question(`? ${message} (y/N)`, a => {
//         console.log({ a });
//         rl.close();
//         resolve(a === 'y');
//       });
//     })
//   };
// }

// function rlinterface() {
//   return {
//     question: (question, defaultInput) => new Promise((resolve) => {
//       const qName = question.name || Math.random(); //('question_');
//       const enhancedQ = {
//         type: 'input',
//         name: qName,
//         default: defaultInput || null,
//         ...question
//       };
//
//       inquirer.prompt([enhancedQ], a => resolve(a[qName]));
//     }),
//     confirmation: (message, defaultInput) => new Promise((resolve) => {
//       const enhancedQ = {
//         message: `${message} (y/n)`,
//         name: Math.random(), //('yes_or_no_question_'),
//         type: 'input',
//         default: defaultInput || 'n'
//       };
//
//       inquirer.prompt([enhancedQ], a => resolve(a[enhancedQ.name]));
//     })
//   };
// }

// export const rl = rlinterface();
