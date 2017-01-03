import minimist from 'minimist';
import t from 'tcomb';
import { some, omit, mapValues } from 'lodash';
import validations from './validations';
import version from './npm/version';
import publish from './npm/publish';
import release from './github/release';
import changelog from './github/changelog';
import { askForToken } from './github/token';
import { onError, rl, log } from './utils';
import config from './config';

const _argv = minimist(process.argv.slice(2));

const { tasks: defaultArgv } = config;

const runDefault = !some(Object.keys(defaultArgv), arg => _argv[arg] === true);

const Argv = t.dict(t.String, t.maybe(t.Boolean));
const argv = Argv(omit(
  runDefault ? { ...defaultArgv, ..._argv } : mapValues(defaultArgv, (v, k) => _argv[k] || false),
  '_'
));
const mainArgument = _argv._[0];

const promptUserBeforeRunningTask = async (task, message) => {
  if (argv[task] === null) {
    const hasConfirmed = await rl.confirmation(message);
    log('\n');
    return hasConfirmed;
  }

  return argv[task];
};

const main = async () => {
  try {
    !config.github.token && await askForToken();

    if (await promptUserBeforeRunningTask('validations', 'Do you want to run the "validations" task?')) {
      await validations();
    }

    if (await promptUserBeforeRunningTask('npm-version', 'Do you want to run the "npm-version" task and increase the version of you library?')) {
      await version(mainArgument);
    }

    if (await promptUserBeforeRunningTask('changelog', 'Do you want to run the "changelog" task and update the CHANGELOG.md file?')) {
      await changelog();
    }

    if (await promptUserBeforeRunningTask('gh-release', 'Do you want to run the "gh-release" task and create a release on GitHub for the last version of you library?')) {
      await release({ all: false });
    }

    if (await promptUserBeforeRunningTask('npm-publish', 'Do you want to run the "npm-publish" task and publish your library on npm?')) {
      await publish();
    }

    if (await promptUserBeforeRunningTask('gh-release-all', 'Do you want to run the "gh-release-all" task and create a release on GitHub for every version of your library?')) {
      await release({ all: true });
    }
  } catch (e) {
    onError(e);
  }
};

main();
