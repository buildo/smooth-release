import semver from 'semver';
import { find, sortBy, range } from 'lodash';
import {
  github,
  isVersionTag,
  getPackageJsonVersion,
  info,
  title,
  log,
  emptyLine,
  SmoothReleaseError,
  status,
  rl,
  exec
} from '../utils';

const stdio = [process.stdin, null, process.stderr];

const checkIfVersionShouldBeBreaking = async ({ lastVersionTag, dataType }) => {
  if (dataType === 'issues') {
    let breakingIssuesUpdatedAfterLastTag = undefined;
    let lastVersionTagDateTime = undefined;

    if (lastVersionTag) {
      const lastVersionTagSha = lastVersionTag.commit.sha;

      const tagCommit = await github.commits(lastVersionTagSha).fetch();
      lastVersionTagDateTime = tagCommit.commit.author.date;

      const issuesUpdatedAfterLastTag = await github.issues.fetch({ state: 'closed', since: lastVersionTagDateTime });
      const unpublishedIssues = issuesUpdatedAfterLastTag.filter(i => i.closedAt >= new Date(lastVersionTagDateTime));

      if (unpublishedIssues.length === 0) {
        throw new SmoothReleaseError('Can\'t find any issue closed after last publish. Are you sure there are new features to publish?');
      }
      breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
    } else {
      breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed' });
    }

    // VERIFY IF RELEASE SHOULD BE BREAKING
    const unpublishedBreakingIssues = breakingIssuesUpdatedAfterLastTag.filter(i => !lastVersionTagDateTime || i.closedAt >= new Date(lastVersionTagDateTime));
    return unpublishedBreakingIssues.length > 0;
  } else if (dataType === 'pullRequests') {
    let breakingPullRequestsMergedAfterLastTag = undefined;
    let lastVersionTagDateTime = undefined;

    if (lastVersionTag) {
      const lastVersionTagSha = lastVersionTag.commit.sha;

      const tagCommit = await github.commits(lastVersionTagSha).fetch();
      lastVersionTagDateTime = tagCommit.commit.author.date;

      const pullRequestsMergedAfterLastTag = await github.pulls.fetch({ state: 'closed', since: lastVersionTagDateTime });
      const unpublishedMergedPullRequests = pullRequestsMergedAfterLastTag.filter(i => i.mergedAt >= new Date(lastVersionTagDateTime));

      if (unpublishedMergedPullRequests.length === 0) {
        throw new SmoothReleaseError('Can\'t find any merged pull request after last publish. Are you sure there are new features to publish?');
      }
      breakingPullRequestsMergedAfterLastTag = await github.pulls.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
    } else {
      breakingPullRequestsMergedAfterLastTag = await github.pulls.fetch({ labels: 'breaking', state: 'closed' });
    }

    // VERIFY IF RELEASE SHOULD BE BREAKING
    const unpublishedBreakingPullRequests = breakingPullRequestsMergedAfterLastTag.filter(i => !lastVersionTagDateTime || i.closedAt >= new Date(lastVersionTagDateTime));
    return unpublishedBreakingPullRequests.length > 0;
  }
};

const computeRelease = async ({ manualVersion, dataType, packageJsonVersion }) => {
  info('Compute release');

  if (!manualVersion) {
    status.addSteps([
      'Get all tags from GitHub',
      'Check if version should be "breaking"',
      'Compute version'
    ]);

    // AVOID DUPLICATE PUBLISHED VERSIONS
    const tags = await github.tags.fetch();
    status.doneStep(true);


    // CHECK IF VERSION SHOULD BE BREAKING
    const lastVersionTag = find(tags, isVersionTag);
    const isBreaking = await checkIfVersionShouldBeBreaking({ lastVersionTag, dataType });
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
  } else {
    status.addSteps([
      'Compute version'
    ]);

    const version = semver.valid(manualVersion) || semver.inc(packageJsonVersion, manualVersion);

    if (semver.lte(version, packageJsonVersion)) {
      throw new SmoothReleaseError(`You can't pass a version lower than or equal to "${packageJsonVersion}" (current version)`);
    }

    const isBeta = semver.satisfies(packageJsonVersion, '< 1');
    const level = semver.diff(packageJsonVersion, version);
    const isBreaking = level === 'major';
    status.doneStep(true);

    return {
      isBeta,
      isBreaking,
      level,
      version
    };
  }
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
    throw new SmoothReleaseError('You refused the computed release. Aborting');
  }

  emptyLine();
};

const version = async (releaseInfo) => {
  info('Increase version');
  status.addSteps([
    `Ensure tag "v${releaseInfo.version}" doesn\'t already exist`,
    'Run "npm version --no-git-tag-version"'
  ]);

  const tagAlreadyExists = await exec(`git rev-parse -q --verify v${releaseInfo.version}`).then(() => true).catch(() => false);

  if (tagAlreadyExists) {
    throw new SmoothReleaseError(`tag "v${releaseInfo.version}" already exists.`);
  } else {
    status.doneStep(true);
  }

  await exec(`npm version v${releaseInfo.version} --no-git-tag-version`, { stdio });
  status.doneStep(true);
};

export default async ({ manualVersion, dataType }) => {
  title('Increase version in "package.json"');

  const releaseInfo = await computeRelease({
    manualVersion,
    dataType,
    packageJsonVersion: getPackageJsonVersion()
  });

  await confirmation(releaseInfo);

  await version(releaseInfo);
};
