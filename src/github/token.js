import os from 'os';
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import { rl, info } from '../utils';

const tokenFilePath = `${os.homedir()}/.smooth-release/gh_token`;

mkdirp.sync(path.dirname(tokenFilePath));

const token = fs.existsSync(tokenFilePath) ?
  fs.readFileSync(tokenFilePath, { encoding: 'utf8' }) :
  null;

export default (_tokenParam) => _tokenParam || token;

export const askForToken = async (message) => {
  info('');
  const token = await rl.question(message || 'Could not find any stored GitHub token. Please write here a valid token:');

  if (!token || token.length !== 40) { // GitHub token length
    return askForToken('The given token was invalid! Please write here a valid token:');
  }

  fs.writeFileSync(tokenFilePath, token);
  info('\nToken correctly saved. Please restart smooth-release.');
  process.exit(0);
};
