import { exec as _exec, execSync } from 'child_process';
import fs from 'fs';
import elegantStatus from 'elegant-status';
import Octokat from 'octokat';
import console from 'better-console';
import inquirer from 'inquirer';
import { startsWith, every } from 'lodash';
import errorEx from 'error-ex';
import config from './config';

// LOGS
export const log = console.log;
export const info = console.info;
export const warning = console.warn;
export const error = console.error;
export const title = title => (
  warning(`\n${title.toUpperCase()}\n${title.split('').map(() => '-').join('')}\n`)
);
export const emptyLine = () => log('');


// STATUS
const Status = () => {
  let steps = null;
  let done = null;

  const runNextStep = () => {
    if (steps.length > 0) {
      done = elegantStatus(steps.shift());
    }
  };

  return {
    addSteps: newSteps => {
      !done && steps && emptyLine();

      steps = (steps || []).concat(newSteps);
      !done && runNextStep(); // if idle run first step in the list
    },
    doneStep: res => {
      done(res);
      done = null;
      runNextStep();
    },
    stop: () => {
      steps = [];
      done && done(false);
    }
  };
};

export const status = Status();


// EXEC INTERFACE
export const exec = (command, settings) => {
  return new Promise((resolve, reject) => {
    _exec(command, settings, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
};


// CUSTOM ERROR
export const SmoothReleaseError = errorEx('SmoothReleaseError');

export const onError = e => {
  status.stop();
  if (e instanceof SmoothReleaseError) {
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

export const getPackageJsonVersion = () => (
  JSON.parse(fs.readFileSync(`${getRootFolderPath()}/package.json`)).version
);


// OCTOKAT
export const getGithubOwnerAndRepo = () => {
  const remoteOriginUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();

  const [owner, repo] = remoteOriginUrl.slice(startsWith(remoteOriginUrl, 'https') ? 19 : 15, remoteOriginUrl.length - 4).split('/');

  return { owner, repo };
};

const octokat = new Octokat({ token: config.github.token });

const { owner, repo } = getGithubOwnerAndRepo();
export const github = octokat.repos(`${owner}/${repo}`);


// RL INTERFACE
function rlinterface() {
  return {
    question: (message, defaultInput) => new Promise((resolve) => {
      const question = {
        message,
        name: Date.now(),
        type: 'input',
        default: defaultInput || null
      };

      inquirer.prompt([question], a => resolve(a[question.name]));
    }),
    confirmation: (message, defaultInput) => new Promise((resolve) => {
      const question = {
        message: `${message} (y/n)`,
        name: Date.now(),
        type: 'input',
        default: defaultInput || 'n'
      };

      inquirer.prompt([question], a => resolve(a[question.name] === 'y'));
    })
  };
}

export const rl = rlinterface();
