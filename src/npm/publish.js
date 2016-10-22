import { execSync } from 'child_process';
import { find } from 'lodash';
import { github, getCurrentBranch, isVersionTag, log } from '../utils';
import config from '../config';

const stdio = [process.stdin, process.stdout, process.stderr];

export default async () => {
  // ENFORCE BRANCH

  if (config.publish.branch !== null && getCurrentBranch() !== config.publish.branch) {
    throw new Error(`You must be on "${config.publish.branch}" branch to perform this task. Aborting.`);
  }


  // ENFORCE SYNC WITH REMOTE

  if (config.publish.inSyncWithRemote) {
    log('Updating remote branches...');
    execSync('git fetch');
    log('Done\n');

    const LOCAL = execSync('git rev-parse @', { encoding: 'utf8' }).trim();
    const REMOTE = execSync('git rev-parse @{u}', { encoding: 'utf8' }).trim();
    const BASE = execSync('git merge-base @ @{u}', { encoding: 'utf8' }).trim();

    if (LOCAL !== REMOTE && LOCAL === BASE) {
      throw new Error('Your local branch is out-of-date. Please pull the latest remote changes. Aborting.');
    } else if (LOCAL !== REMOTE && REMOTE === BASE) {
      throw new Error('Your local branch is ahead of its remote branch. Please push your local changes. Aborting.');
    } else if (LOCAL !== REMOTE) {
      throw new Error('Your local and remote branches have diverged. Please put them in sync. Aborting.');
    }
  }


  // AVOID DUPLICATE PUBLISHED VERSIONS
  const tags = await github.tags.fetch();

  let breakingIssuesUpdatedAfterLastTag = undefined;
  let lastVersionTagDateTime = undefined;
  const lastVersionTag = find(tags, isVersionTag);

  if (lastVersionTag) {
    const lastVersionTagSha = lastVersionTag.commit.sha;

    const tagCommit = await github.commits(lastVersionTagSha).fetch();
    lastVersionTagDateTime = tagCommit.commit.author.date;

    const issuesUpdatedAfterLastTag = await github.issues.fetch({ state: 'closed', since: lastVersionTagDateTime });
    const unpublishedIssues = issuesUpdatedAfterLastTag.filter(i => i.closed_at >= lastVersionTagDateTime);

    if (unpublishedIssues.length === 0) {
      throw new Error('Can\'t find any issue closed after last publish. Are you sure there are new features to publish?');
    }
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
  } else {
    breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed' });
  }

  // VERIFY IF RELEASE SHOULD BE BREAKING
  const unpublishedBreakingIssues = breakingIssuesUpdatedAfterLastTag.filter(i => !lastVersionTagDateTime || i.closed_at >= lastVersionTagDateTime);
  const isBreaking = unpublishedBreakingIssues.length > 0;

  // START RELEASE PROCESS

  log(`RUN "npm version ${isBreaking ? 'minor' : 'patch'}"`);
  execSync(`npm version ${isBreaking ? 'minor' : 'patch'}`, { stdio });

  log('RUN "npm publish"');
  execSync('npm publish', { stdio });

  log('RUN "git push"');
  execSync('git push', { stdio });

  log('RUN "git push --tags"');
  execSync('git push --tags', { stdio });

  log(`\n Successfully released a new "${isBreaking ? 'BREAKING' : 'PATCH'}" version: "v${require('./package.json').version}"`);
};
