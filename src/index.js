import fs from 'fs';
import minimist from 'minimist';
import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { onError, getRootFolderPath } from './utils';

const _argv = minimist(process.argv.slice(2));
const packageJSON = JSON.parse(fs.readFileSync(`${getRootFolderPath()}/package.json`));

const defaultArgv = { 'npm-publish': true, 'gh-release': true, changelog: true };

const argv = (_argv['npm-publish'] || _argv['gh-release'] || _argv.changelog) ?
  _argv :
  defaultArgv;

const main = async () => {
  argv['npm-publish'] && await publish().catch(onError);
  argv.changelog && await changelog().catch(onError);
  argv['gh-release'] && await release(packageJSON.version).catch(onError);
};

main();
