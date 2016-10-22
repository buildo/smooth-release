import { execSync } from 'child_process';
import debug from 'debug';
import Octokat from 'octokat';
import { startsWith, every } from 'lodash';
import config from './config';

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


// OCTOKAT

export const getGithubOwnerAndRepo = () => {
  const remoteOriginUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim();

  const [owner, repo] = remoteOriginUrl.slice(startsWith(remoteOriginUrl, 'https') ? 19 : 15, remoteOriginUrl.length - 4).split('/');

  return { owner, repo };
};

const octokat = config.github.token ? new Octokat({ token: config.github.token }) : new Octokat();

const { owner, repo } = getGithubOwnerAndRepo();
export const github = octokat.repos(`${owner}/${repo}`);
