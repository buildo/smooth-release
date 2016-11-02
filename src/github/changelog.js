import fs from 'fs';
import { execSync } from 'child_process';
import stagger from 'staggerjs';
import status from 'node-status';
import { find, some, sortBy } from 'lodash';
import { github, getGithubOwnerAndRepo, getRootFolderPath, info, warning } from '../utils';
import getAllTags from '../modules/getAllTags';
import getAllClosedIssues from '../modules/getAllClosedIssues';
import config from '../config';

const { owner, repo } = getGithubOwnerAndRepo();

const addCreatedAtInfoToTags = async tags => {
  return await stagger(tags.map(tag => async () => {
    const tagCommit = await github.commits(tag.commit.sha).fetch();
    return {
      ...tag,
      createdAt: new Date(tagCommit.commit.author.date)
    };
  }), { maxOngoingMethods: 10, perSecond: 20 });
};

const hasAtLeastOneLabel = (issue, labels) => some(labels, label => find(issue.labels, { name: label }));

const groupIssuesByTag = (closedIssues, tags) => {
  const tagsSortedAsc = sortBy(tags, ['createdAt']);
  return closedIssues.reduce((issuesByTag, issue) => {
    const tag = find(tagsSortedAsc, tag => tag.createdAt > issue.createdAt);

    if (tag) {
      return {
        ...issuesByTag,
        [tag.name]: (issuesByTag[tag.name] || []).concat(issue)
      };
    }

    return {
      ...issuesByTag,
      unreleased: (issuesByTag.unreleased || []).concat(issue)
    };
  }, {});
};

const groupIssuesByType = issues => {
  const isBreaking = issue => hasAtLeastOneLabel(issue, config.github.changelog.breaking.labels);
  const isBug = issue => hasAtLeastOneLabel(issue, config.github.changelog.bug.labels);

  return issues.reduce((issuesByType, issue) => {
    if (isBreaking(issue)) {
      return {
        ...issuesByType,
        breaking: (issuesByType.breaking || []).concat(issue)
      };
    } else if (isBug(issue)) {
      return {
        ...issuesByType,
        bug: (issuesByType.bug || []).concat(issue)
      };
    } else {
      return {
        ...issuesByType,
        feature: (issuesByType.feature || []).concat(issue)
      };
    }
  }, {});
};

const createChangelogSection = ({ previousTag, tag, issues = [] }) => {
  const dateTime = tag ? ` (${tag.createdAt.toISOString().slice(0, 10)})` : '';
  const tagLink = `## [${tag ? tag.name : 'Unreleased'}](https://github.com/${owner}/${repo}/tree/${tag ? tag.name : 'HEAD'})${dateTime}`;
  const fullChangelogLink = previousTag ? `[Full Changelog](https://github.com/${owner}/${repo}/compare/${previousTag.name}...${tag ? tag.name : 'HEAD'})` : '';
  const header = `${tagLink}\n${fullChangelogLink}`;

  if (issues.length === 0) {
    return header;
  }

  const issuesGroupedByType = groupIssuesByType(issues);

  const types = Object.keys(issuesGroupedByType);

  const content = types.reduce((acc, type) => {
    const issues = issuesGroupedByType[type].map(issue => `- ${issue.title} [#${issue.number}](${issue.htmlUrl})`).join('\n');
    return `${acc}\n\n${config.github.changelog[type].title}\n\n${issues}`;
  }, '');

  return `${header}\n\n${content.trim()}`;
};

const statusSteps = status.addItem('changelog', {
  steps: [
    'Get all closed issues from GitHub',
    'Get all tags from GitHub',
    'Generate changelog for each tag',
    'Save changelog'
  ]
});

export default async () => {
  info('Generate CHANGELOG.md');
  status.start({ pattern: '{spinner.cyan}' });
  // GET closed issues
  const closedIssues = (await getAllClosedIssues()).filter(i => !hasAtLeastOneLabel(i, config.github.changelog.ignoredLabels));
  statusSteps.doneStep(true);

  // GET tags
  const tags = await getAllTags();

  // ADD "created-at" info to each tag
  const tagsWithCreatedAt = tags.length ? await addCreatedAtInfoToTags(tags) : tags;
  statusSteps.doneStep(true);

  // GROUP issues by tag
  const issuesGroupedByTag = groupIssuesByTag(closedIssues, tagsWithCreatedAt);

  // WRITE changelog for each tag
  const changelogSections = tagsWithCreatedAt.map((tag, i) => (
    createChangelogSection({ tag, previousTag: tagsWithCreatedAt[i + 1], issues: issuesGroupedByTag[tag.name] })
  ));

  // WRITE changelog for unreleased issues (without tag)
  const unreleased = issuesGroupedByTag.unreleased ? createChangelogSection({ previousTag: tagsWithCreatedAt[0], tag: null, issues: issuesGroupedByTag.unreleased }) : '';

  // WRITE complete changelog
  const changelogMarkdown = `#  Change Log\n\n${[unreleased].concat(changelogSections).join('\n\n')}`;
  statusSteps.doneStep(true);

  // SAVE changelog
  fs.writeFileSync(`${getRootFolderPath()}/${config.github.changelog.outputPath}`, changelogMarkdown);

  // PUSH changes]
  try {
    execSync(`git add ${config.github.changelog.outputPath}`);
    execSync('git commit -m "Update CHANGELOG.md"');
    execSync('git push');
    statusSteps.doneStep(true);
  } catch (e) {
    statusSteps.doneStep(false);
    warning('   - CHANGELOG.md hasn\'t changed');
  }

  status.stop();

  return changelogMarkdown;
};
