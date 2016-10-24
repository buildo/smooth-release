import { execSync } from 'child_process';
import debug from 'debug';
import Octokat from 'octokat';
import { startsWith, every, chunk } from 'lodash';
import config from './config';
import t from 'tcomb';

// LOGS

export const log = debug('releso:log');
log.log = console.log.bind(console); // eslint-disable-line no-console

export const info = debug('releso:info');
info.log = console.info.bind(console); // eslint-disable-line no-console

export const warning = debug('releso:warning');
warning.log = console.warn.bind(console); // eslint-disable-line no-console

export const error = debug('releso:error');

export const onError = e => {
  error(`\nError: ${e.message}`);
  process.exit(1);
};


// UTILS

export const getCurrentBranch = () => execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();

export const isVersionTag = tag => (
  startsWith(tag.name, 'v') && every(tag.name.slice(1).split('.'), s => typeof parseInt(s) === 'number')
);

export const getRootFolderPath = () => execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

export const staggerAsyncCommands = (commands, groupSize) => {
  const chunks = chunk(commands, groupSize);

  const runCommandsChunk = (commands) => Promise.all(commands.map(f => f()));

  return chunks.reduce((acc, chunk) => {
    return acc.then((prevResult) => runCommandsChunk(chunk).then(res => prevResult.concat(res)));
  }, Promise.resolve([]));
};


// OCTOKAT

export const getGithubOwnerAndRepo = () => {
  const remoteOriginUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();

  const [owner, repo] = remoteOriginUrl.slice(startsWith(remoteOriginUrl, 'https') ? 19 : 15, remoteOriginUrl.length - 4).split('/');

  return { owner, repo };
};

const octokat = config.github.token ? new Octokat({ token: config.github.token }) : new Octokat();

const { owner, repo } = getGithubOwnerAndRepo();
export const github = octokat.repos(`${owner}/${repo}`);


const Methods = t.list(t.Function);
const Settings = t.interface({
  perSecond: t.Integer,
  maxOngoingMethods: t.Integer
}, { strict: true });

export const stagger = (_methods, _settings) => {
  const methods = Methods(_methods);
  const { maxOngoingMethods, perSecond } = Settings(_settings);

  return new Promise((resolve) => {
    const minTimeBetweenMethods = 1000 / perSecond;

    let done = [];
    let ongoing = [];
    let stack = [];
    let lastRun = null;

    const runMethod = method => {
      lastRun = Date.now();
      const id = `${Math.random()}`;
      const onDone = res => {
        // move to "done"
        ongoing = ongoing.filter(x => x.id !== id);
        done = done.concat(res);

        if (stack.length > 0) {
          // run next method
          const timeoutMillis = Math.max(minTimeBetweenMethods - (Date.now() - lastRun), 0);

          const run = () => {
            runMethod(stack[0]);
            // update stack
            stack = stack.slice(1, stack.length);
          };

          timeoutMillis > 0 && setTimeout(run, timeoutMillis);
          timeoutMillis <= 0 && run();
        } else {
          resolve(done);
        }
      };

      ongoing = ongoing.concat({ id, promise: method().then(onDone).catch(onDone) });
    };

    stack = stack.concat(methods.slice(maxOngoingMethods, stack.length - 1));
    ongoing = ongoing.concat(methods.slice(0, maxOngoingMethods).map((m, i) => setTimeout(() => runMethod(m), minTimeBetweenMethods * i)));
  });
};
