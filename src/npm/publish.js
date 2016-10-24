import { execSync } from 'child_process';
import status from 'node-status';
import { find } from 'lodash';
import { github, getCurrentBranch, isVersionTag } from '../utils';
import config from '../config';

const stdio = [process.stdin, process.stdout, process.stderr];

const statusSteps = status.addItem('publish', {
  steps: [
    config.publish.branch && 'Validate branch',
    config.publish.inSyncWithRemote && 'Validate sync with remote',
    'Get all tags from GitHub',
    'Check if version should be "breaking"',
    'Run "npm version"',
    'Run "npm publish"',
    'Push changes and tags on GitHub'
  ].filter(x => x)
});

export default async () => {
  status.start({ pattern: '{spinner.cyan}' });

  // ENFORCE BRANCH
  if (config.publish.branch !== null) {
    if (getCurrentBranch() !== config.publish.branch) {
      statusSteps.doneStep(false);
      throw new Error(`You must be on "${config.publish.branch}" branch to perform this task. Aborting.`);
    }
    statusSteps.doneStep(true);
  }

  // ENFORCE SYNC WITH REMOTE
  if (config.publish.inSyncWithRemote) {
    execSync('git fetch');

    const LOCAL = execSync('git rev-parse @', { encoding: 'utf8' }).trim();
    const REMOTE = execSync('git rev-parse @{u}', { encoding: 'utf8' }).trim();
    const BASE = execSync('git merge-base @ @{u}', { encoding: 'utf8' }).trim();

    if (LOCAL !== REMOTE && LOCAL === BASE) {
      statusSteps.doneStep(false);
      throw new Error('Your local branch is out-of-date. Please pull the latest remote changes. Aborting.');
    } else if (LOCAL !== REMOTE && REMOTE === BASE) {
      statusSteps.doneStep(false);
      throw new Error('Your local branch is ahead of its remote branch. Please push your local changes. Aborting.');
    } else if (LOCAL !== REMOTE) {
      statusSteps.doneStep(false);
      throw new Error('Your local and remote branches have diverged. Please put them in sync. Aborting.');
    }
    statusSteps.doneStep(true);
  }


  // AVOID DUPLICATE PUBLISHED VERSIONS
  const tags = await github.tags.fetch();
  statusSteps.doneStep(true);

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
      throw new Error('Can\'t find any issue closed after last publish. Are you sure there are new features to publish?');
    }
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
  } else {
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed' });
  }

  // VERIFY IF RELEASE SHOULD BE BREAKING
  const unpublishedBreakingIssues = breakingIssuesUpdatedAfterLastTag.filter(i => !lastVersionTagDateTime || i.closedAt >= new Date(lastVersionTagDateTime));
  const isBreaking = unpublishedBreakingIssues.length > 0;

  statusSteps.doneStep(true);

  // START RELEASE PROCESS
  execSync(`npm version ${isBreaking ? 'minor' : 'patch'}`, { stdio });
  statusSteps.doneStep(true);

  execSync('npm publish', { stdio });
  statusSteps.doneStep(true);

  execSync('git push', { stdio });
  execSync('git push --tags', { stdio });
  statusSteps.doneStep(true);
};
