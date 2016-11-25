import { some } from 'lodash';
import {
  getCurrentBranch,
  title,
  CustomError,
  status,
  exec
} from '../utils';
import config from '../config';

const validateBranch = async () => {
  // ENFORCE BRANCH
  if (config.publish.branch !== null) {
    status.addSteps(['Validate branch']);

    if (getCurrentBranch() !== config.publish.branch) {
      throw new CustomError(`You must be on "${config.publish.branch}" branch to perform this task. Aborting.`);
    }
    status.doneStep(true);
  }
};

const validateNoUncommittedChanges = async () => {
  // ENFORCE NO UNCOMMITTED CHANGES
  if (config.publish.noUncommittedChanges) {
    status.addSteps(['Validate uncommitted changes']);

    if (/^([ADRM]| [ADRM])/m.test(await exec('git status --porcelain'))) {
      throw new CustomError('You have uncommited changes in your working tree. Aborting.');
    }
    status.doneStep(true);
  }
};

const validateNoUntrackedFiles = async () => {
  // ENFORCE NO UNTRACKED FILES
  if (config.publish.noUntrackedFiles) {
    status.addSteps(['Validate untracked files']);

    if (/^\?\?/m.test(await exec('git status --porcelain'))) {
      throw new CustomError('You have untracked files in your working tree. Aborting.');
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
      throw new CustomError('Your local branch is out-of-date. Please pull the latest remote changes. Aborting.');
    } else if (LOCAL !== REMOTE && REMOTE === BASE) {
      throw new CustomError('Your local branch is ahead of its remote branch. Please push your local changes. Aborting.');
    } else if (LOCAL !== REMOTE) {
      throw new CustomError('Your local and remote branches have diverged. Please put them in sync. Aborting.');
    }
    status.doneStep(true);
  }
};

export default async () => {
  const shouldRunAtLeastOneValidation = some(config.publish);
  if (shouldRunAtLeastOneValidation) {
    title('Run validations');

    await validateBranch();
    await validateNoUncommittedChanges();
    await validateNoUntrackedFiles();
    await validateInSyncWithRemote();
  }
};
