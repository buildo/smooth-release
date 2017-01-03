import minimist from 'minimist';
import { some } from 'lodash';
import validations from './validations';
import version from './npm/version';
import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { askForToken } from './github/token';
import { onError, rl } from './utils';
import config from './config';

const _argv = minimist(process.argv.slice(2));

const defaultArgv = {
  validations: true,
  'npm-publish': true,
  'npm-version': true,
  'gh-release': true,
  'gh-release-all': false,
  changelog: true
};

const runDefault = !some(Object.keys(defaultArgv), arg => _argv[arg] === true);

const argv = runDefault ? { ...defaultArgv, ..._argv } : _argv;
const mainArgument = _argv._[0];

const promptUserBeforeRunningTask = async (task, message) => {
  if (argv[task] === null) {
    return await rl.confirmation(message);
  }

  return argv[task];
};

const main = async () => {
  try {
    !config.github.token && await askForToken();

    argv.validations && await validations();

    argv['npm-version'] && await version(mainArgument);

    argv.changelog && await changelog();

    argv['gh-release'] && await release({ all: false });

    ((runDefault && argv['npm-publish']) || _argv['npm-publish']) && await publish();

    argv['gh-release-all'] && await release({ all: true });
  } catch (e) {
    onError(e);
  }
};

main();
