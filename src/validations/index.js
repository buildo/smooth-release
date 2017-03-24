import fs from 'fs';
import { some, includes, flatten } from 'lodash';
import {
  getPackageJsonName,
  getPackageJsonFiles,
  getRootFolderPath,
  getCurrentBranch,
  title,
  SmoothReleaseError,
  status,
  exec,
  octokat
} from '../utils';
import config from '../config';
import { askForToken } from '../github/token';

const validateBranch = async () => {
  // ENFORCE BRANCH
  if (config.publish.branch !== null) {
    status.addSteps(['Validate branch']);

    if (getCurrentBranch() !== config.publish.branch) {
      throw new SmoothReleaseError(`You must be on "${config.publish.branch}" branch to perform this task. Aborting.`);
    }
    status.doneStep(true);
  }
};

const validateNoUncommittedChanges = async () => {
  // ENFORCE NO UNCOMMITTED CHANGES
  if (config.publish.noUncommittedChanges) {
    status.addSteps(['Validate uncommitted changes']);

    if (/^([ADRM]| [ADRM])/m.test(await exec('git status --porcelain'))) {
      throw new SmoothReleaseError('You have uncommited changes in your working tree. Aborting.');
    }
    status.doneStep(true);
  }
};

const validateNoUntrackedFiles = async () => {
  // ENFORCE NO UNTRACKED FILES
  if (config.publish.noUntrackedFiles) {
    status.addSteps(['Validate untracked files']);

    if (/^\?\?/m.test(await exec('git status --porcelain'))) {
      throw new SmoothReleaseError('You have untracked files in your working tree. Aborting.');
    }
    status.doneStep(true);
  }
};

const validateInSyncWithRemote = async () => {
  // ENFORCE SYNC WITH REMOTE
  if (config.publish.inSyncWithRemote) {
    status.addSteps(['Validate sync with remote']);

    await exec('git fetch');

    const LOCAL = (await exec('git rev-parse @', { encoding: 'utf8' })).trim();
    const REMOTE = (await exec('git rev-parse @{u}', { encoding: 'utf8' })).trim();
    const BASE = (await exec('git merge-base @ @{u}', { encoding: 'utf8' })).trim();

    if (LOCAL !== REMOTE && LOCAL === BASE) {
      throw new SmoothReleaseError('Your local branch is out-of-date. Please pull the latest remote changes. Aborting.');
    } else if (LOCAL !== REMOTE && REMOTE === BASE) {
      throw new SmoothReleaseError('Your local branch is ahead of its remote branch. Please push your local changes. Aborting.');
    } else if (LOCAL !== REMOTE) {
      throw new SmoothReleaseError('Your local and remote branches have diverged. Please put them in sync. Aborting.');
    }
    status.doneStep(true);
  }
};

const validateNpmCredentials = async () => {
  // THERE MUST BE A LOGGED IN USER WITH VALID CREDENTIALS
  if (config.publish.validNpmCredentials) {
    status.addSteps(['Validate user\'s credentials for "npm"']);

    const trim = s => s.trim();

    const user = await exec('npm whoami', { encoding: 'utf8' }).then(trim).catch(() => null);

    if (!user) {
      throw new SmoothReleaseError('There is no logged in user for "npm"');
    }

    const packageJsonName = getPackageJsonName();

    const collaborators = JSON.parse(await exec(`npm access ls-collaborators ${packageJsonName}`).then(trim).catch(() => null));
    const packageAlreadyInRegistry = !!collaborators;

    if (packageAlreadyInRegistry && collaborators[user] !== 'read-write') {

      const teamsWithWriteAccess = Object.keys(collaborators).filter(name => includes(name, ':') && collaborators[name] === 'read-write');

      const teamMembers = flatten(await Promise.all(teamsWithWriteAccess.map(async team => (
        JSON.parse(await exec(`npm team ls ${team}`).then(trim).catch(() => null))
      ))));

      if (!includes(teamMembers, user)) {
        throw new SmoothReleaseError(`"${user}" does not have write permissions for "${packageJsonName}"`);
      }
    }

    status.doneStep(true);
  }
};

const validateGithubToken = async () => {
  // THE STORED GITHUB TOKEN MUST BE VALID
  if (config.publish.validGithubToken) {
    status.addSteps(['Validate user\'s token for "GitHub"']);

    const res = await octokat.user.fetch().catch(x => x);

    if (res.status === 401) {
      status.doneStep(false);
      await askForToken('The stored GitHub token is invalid. Please write here a valid token:');
    } else {
      status.doneStep(true);
    }

  }
};

const validatePackageFilesAreFilteredBeforePublish = async () => {
  // THERE MUST BE ONE OF ".npmignore" OR "package.json.files"
  if (config.publish.packageFilesFilter !== false) {
    const hasPackageJsonFiles = !!getPackageJsonFiles();
    const hasNpmIgnore = fs.existsSync(`${getRootFolderPath()}/.npmignore`);

    if (config.publish.packageFilesFilter === 'npmignore') {
      status.addSteps(['Validate project has a ".npmignore" file']);

      if (!hasNpmIgnore) {
        throw new SmoothReleaseError('There must be a ".npmignore" file');
      }
    } else if (config.publish.packageFilesFilter === 'files') {
      status.addSteps(['Validate package.json contains the "files" whitelist']);

      if (!hasPackageJsonFiles) {
        throw new SmoothReleaseError('The package.json must contain the "files" whitelist');
      }
    } else if (config.publish.packageFilesFilter === true) {
      status.addSteps(['Validate one of ".npmignore" or "package.json.files" exist']);

      if (!hasPackageJsonFiles && !hasNpmIgnore) {
        throw new SmoothReleaseError('One of ".npmignore" or "package.json.files" must exist');
      }
    }

    if (hasPackageJsonFiles && hasNpmIgnore) {
      throw new SmoothReleaseError('A project can\'t have both a ".npmignore" blacklist and a "package.json.files" whitelist');
    }
  }
};

export default async ({ mayPublishOnNpm }) => {
  const shouldRunAtLeastOneValidation = some(config.publish);
  if (shouldRunAtLeastOneValidation) {
    title('Run validations');

    await validateBranch();
    await validateNoUncommittedChanges();
    await validateNoUntrackedFiles();
    await validateInSyncWithRemote();
    await validatePackageFilesAreFilteredBeforePublish();
    await validateGithubToken();
    mayPublishOnNpm && await validateNpmCredentials();
  }
};
