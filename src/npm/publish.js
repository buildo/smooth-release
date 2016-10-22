import { execSync } from 'child_process';
import { find } from 'lodash';
import { github, getCurrentBranch, isVersionTag, log } from '../utils';
import config from '../config';

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

    const LOCAL = execSync('git rev-parse @', { stdio: null }).trim();
    const REMOTE = execSync('git rev-parse @{u}', { stdio: null }).trim();
    const BASE = execSync('git merge-base @ @{u}', { stdio: null }).trim();

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
  const lastVersionTagSha = find(tags, isVersionTag).commit.sha;

  const tagCommit = await github.commits(lastVersionTagSha).fetch();
  const lastVersionTagDateTime = tagCommit.commit.author.date;

  const issuesUpdatedAfterLastTag = await github.issues.fetch({ state: 'closed', since: lastVersionTagDateTime });
  const unpublishedIssues = issuesUpdatedAfterLastTag.filter(i => i.closed_at >= lastVersionTagDateTime);

  if (unpublishedIssues.length === 0) {
    throw new Error('Can\'t find any issue closed after last publish. Are you sure there are new features to publish?');
  }


  // VERIFY IF RELEASE SHOULD BE BREAKING

  const breakingIssuesUpdatedAfterLastTag = await github.issues.fetch({ labels: 'breaking', state: 'closed', since: lastVersionTagDateTime });
  const unpublishedBreakingIssues = breakingIssuesUpdatedAfterLastTag.filter(i => i.closed_at >= lastVersionTagDateTime);
  const isBreaking = unpublishedBreakingIssues.length > 0;


  // START RELEASE PROCESS

  log(`RUN "npm version ${isBreaking ? 'minor' : 'patch'}"`);
  execSync(`npm version ${isBreaking ? 'minor' : 'patch'}`);

  log('RUN "npm publish"');
  execSync('npm publish');

  log('RUN "git push"');
  execSync('git push');

  log('RUN "git push --tags"');
  execSync('git push --tags');

  log(`\n Successfully released a new "${isBreaking ? 'BREAKING' : 'PATCH'}" version: "v${require('./package.json').version}"`);
};
