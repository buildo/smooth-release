import semver from 'semver';
import { find, sortBy, range, some } from 'lodash';
import {
  github,
  getCurrentBranch,
  isVersionTag,
  getPackageJsonVersion,
  info,
  title,
  log,
  emptyLine,
  CustomError,
  status,
  rl,
  exec
} from '../utils';
import config from '../config';

const stdio = [process.stdin, null, process.stderr];

const runValidations = async () => {
  const shouldRunValidations = some(config.publish);

  if (shouldRunValidations) {
    info('Run validations');

    // ENFORCE BRANCH
    if (config.publish.branch !== null) {
      status.addSteps(['Validate branch']);

      if (getCurrentBranch() !== config.publish.branch) {
        throw new CustomError(`You must be on "${config.publish.branch}" branch to perform this task. Aborting.`);
      }
      status.doneStep(true);
    }

    // ENFORCE NO UNCOMMITTED CHANGES
    if (config.publish.noUncommittedChanges) {
      status.addSteps(['Validate uncommitted changes']);

      if (/^([ADRM]| [ADRM])/m.test(await exec('git status --porcelain'))) {
        throw new CustomError('You have uncommited changes in your working tree. Aborting.');
      }
      status.doneStep(true);
    }

    // ENFORCE NO UNTRACKED FILES
    if (config.publish.noUntrackedFiles) {
      status.addSteps(['Validate untracked files']);

      if (/^\?\?/m.test(await exec('git status --porcelain'))) {
        throw new CustomError('You have untracked files in your working tree. Aborting.');
      }
      status.doneStep(true);
    }

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
  }
};

const computeRelease = async (packageJsonVersion) => {
  info('Compute release');
  status.addSteps([
    'Get all tags from GitHub',
    'Check if version should be "breaking"',
    'Compute version'
  ]);

  // AVOID DUPLICATE PUBLISHED VERSIONS
  const tags = await github.tags.fetch();
  status.doneStep(true);

  let breakingIssuesUpdatedAfterLastTag = undefined;
  let lastVersionTagDateTime = undefined;
  const lastVersionTag = find(tags, isVersionTag);

  if (lastVersionTag) {
    const lastVersionTagSha = lastVersionTag.commit.sha;

    const tagCommit = await github.commits(lastVersionTagSha).fetch();
    lastVersionTagDateTime = tagCommit.commit.author.date;

    const issuesUpdatedAfterLastTag = await github.issues.fetch({ state: 'closed', since: lastVersionTagDateTime });
    const unpublishedIssues = issuesUpdatedAfterLastTag.filter(i => i.closedAt >= new Date(lastVersionTagDateTime));

    if (unpublishedIssues.length === 0) {
      throw new CustomError('Can\'t find any issue closed after last publish. Are you sure there are new features to publish?');
    }
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
  } else {
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed' });
  }

  // VERIFY IF RELEASE SHOULD BE BREAKING
  const unpublishedBreakingIssues = breakingIssuesUpdatedAfterLastTag.filter(i => !lastVersionTagDateTime || i.closedAt >= new Date(lastVersionTagDateTime));
  const isBreaking = unpublishedBreakingIssues.length > 0;
  status.doneStep(true);

  // COMPUTE RELEASE INFO
  const isBeta = semver.satisfies(packageJsonVersion, '< 1');
  const level = isBeta ?
    (isBreaking ? 'minor' : 'patch') :
    (isBreaking ? 'major' : 'patch');
  const version = semver.inc(packageJsonVersion, level);
  status.doneStep(true);

  return {
    isBeta,
    isBreaking,
    level,
    version
  };
};

const confirmation = async releaseInfo => {
  info('Release Info');

  const keys = Object.keys(releaseInfo);
  const longestKey = sortBy(keys, key => key.length)[keys.length - 1];

  keys.forEach((key, i) => {
    const emptySpaces = range(longestKey.length - key.length + 1).map(() => ' ').join('');
    const emptyLine = i === keys.length - 1 ? '\n' : '';

    log(`  ${key}:${emptySpaces}${releaseInfo[key]}${emptyLine}`);
  });

  if (!(await rl.confirmation('If you continue you will update "package.json" and add a tag. Are you sure?'))) {
    throw new CustomError('You refused the computed release. Aborting');
  }

  emptyLine();
};

const version = async (releaseInfo) => {
  info('Increase version');
  status.addSteps([
    'Run "npm preversion" and "npm version"',
    'Push changes and tags to GitHub'
  ]);

  await exec(`npm version v${releaseInfo.version}`, { stdio });
  status.doneStep(true);

  await exec('git push', { stdio });
  await exec('git push --tags', { stdio });
  status.doneStep(true);
};

export default async () => {
  title('Increase version and publish package on npm');

  await runValidations();

  const releaseInfo = await computeRelease(getPackageJsonVersion());

  await confirmation(releaseInfo);

  await version(releaseInfo);
};
