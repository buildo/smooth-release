import minimist from 'minimist';
import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { askForToken } from './github/token';
import { onError } from './utils';
import config from './config';

const _argv = minimist(process.argv.slice(2));

const defaultArgv = { 'npm-publish': true, 'gh-release': true, changelog: true, 'gh-release-all': false };

const argv = (_argv['npm-publish'] || _argv['gh-release'] || _argv['gh-release-all'] || _argv.changelog) ?
  _argv :
  defaultArgv;

const main = async () => {
  try {
    !config.github.token && await askForToken();

    argv['npm-publish'] && await publish();
    argv.changelog && await changelog();
    argv['gh-release'] && await release({ all: false });
    argv['gh-release-all'] && await release({ all: true });
  } catch (e) {
    onError(e);
  }
};

main();
