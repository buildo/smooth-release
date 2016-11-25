import minimist from 'minimist';
import { every } from 'lodash';
import validations from './validations';
import version from './npm/version';
import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { askForToken } from './github/token';
import { onError } from './utils';
import config from './config';

const _argv = minimist(process.argv.slice(2));

const defaultArgv = {
  'no-validations': false,
  'npm-publish': true,
  'no-npm-publish': false,
  'npm-version': true,
  'gh-release': true,
  'gh-release-all': false,
  changelog: true
};

const runDefault = every(Object.keys(defaultArgv), arg => typeof _argv[arg] === 'undefined');

const argv = runDefault ? defaultArgv : _argv;
const mainArgument = _argv._[0];

const main = async () => {
  try {
    !config.github.token && await askForToken();

    !argv['no-validations'] && await validations();

    argv['npm-version'] && await version(mainArgument);

    argv.changelog && await changelog();

    argv['gh-release'] && await release({ all: false });

    ((runDefault && !argv['no-npm-publish']) || argv['npm-publish']) && await publish();

    argv['gh-release-all'] && await release({ all: true });
  } catch (e) {
    onError(e);
  }
};

main();
