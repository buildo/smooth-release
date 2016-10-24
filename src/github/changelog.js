import fs from 'fs';
import { find, findLast, some, sortBy } from 'lodash';
import {
  github,
  getGithubOwnerAndRepo,
  getRootFolderPath,
  stagger,
  log
} from '../utils';
import config from '../config';

const { owner, repo } = getGithubOwnerAndRepo();

const getAllClosedIssues = async (acc = [], issues) => {
  !acc.length && log('Getting closed issues');
  acc.length && log(acc.length);

  if (!issues) {
    const firstPage = await github.issues.fetch({ state: 'closed', limit: 100 });
    return getAllClosedIssues(acc.concat(firstPage), firstPage);
  } else if (issues.nextPage) {
    const nextPage = await issues.nextPage();
    return getAllClosedIssues(acc.concat(nextPage), nextPage);
  } else {
    return acc;
  }
};

const getAllTags = async (acc = [], tags) => {
  !acc.length && log('Getting tags');
  acc.length && log(acc.length);

  if (!tags) {
    const firstPage = await github.tags.fetch();
    return getAllTags(acc.concat(firstPage), firstPage);
  } else if (tags.nextPage) {
    const nextPage = await tags.nextPage();
    return getAllTags(acc.concat(nextPage), nextPage);
  } else {
    return acc;
  }
};

const addCreatedAtInfoToTags = async tags => {
  return sortBy(await stagger(tags.map(tag => async () => {
    const tagCommit = await github.commits(tag.commit.sha).fetch();
    return {
      ...tag,
      createdAt: new Date(tagCommit.commit.author.date)
    };
  }), { maxOngoingMethods: 10, perSecond: 20 }), 'createdAt');
};

const hasAtLeastOneLabel = (issue, labels) => some(labels, label => find(issue.labels, { name: label }));

const groupIssuesByTag = (closedIssues, tags) => {
  return closedIssues.reduce((issuesByTag, issue) => {
    const tag = findLast(tags, tag => tag.createdAt > issue.createdAt);

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
  const isBreaking = issue => hasAtLeastOneLabel(issue, config.github.changelog.breakingFeatures.labels);
  const isBug = issue => hasAtLeastOneLabel(issue, config.github.changelog.bugs.labels);

  return issues.reduce((issuesByType, issue) => {

    if (isBreaking) {
      return {
        ...issuesByType,
        breaking: (issuesByType.breaking || []).concat(issue)
      };
    } else if (isBug) {
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
  const tagLink = `## [${tag || 'Unreleased'}](https://github.com/${owner}/${repo}/tree/${tag || 'HEAD'})`;
  const fullChangelogLink = `${previousTag ? `[Full Changelog](https://github.com/${owner}/${repo}/compare/${previousTag}...${tag || 'HEAD'})` : ''}`;
  const header = `${tagLink}\n${fullChangelogLink}`;

  if (issues.length === 0) {
    return header;
  }

  const issuesGroupedByType = groupIssuesByType(issues);

  const types = Object.keys(issuesGroupedByType);

  const content = types.reduce((acc, type) => {
    const issues = issuesGroupedByType[type].map(issue => `- ${issue.title} [#${issue.number}](${issue.url})`).join('\n');
    return `${acc}\n\n${config.github.changelog[type].title}\n\n${issues}`;
  }, '');

  return `${header}\n\n${content}`;
};

const x = async () => {
  // GET closed issues
  const closedIssues = (await getAllClosedIssues()).filter(i => !hasAtLeastOneLabel(i, config.github.changelog.ignoredLabels));

  // GET tags
  const tags = await getAllTags();

  // ADD "created-at" info to each tag
  const tagsWithCreatedAt = addCreatedAtInfoToTags(tags);

  // GROUP issues by tag
  const issuesGroupedByTag = groupIssuesByTag(closedIssues, tagsWithCreatedAt);

  // WRITE changelog for each tag
  const tagNames = tags.map(t => t.name);
  const changelogSections = tagNames.map((tag, i) => (
    createChangelogSection({ tag, previousTag: tagNames[i + 1], issues: issuesGroupedByTag[tag] })
  ));

  // WRITE changelog for unreleased issues (without tag)
  const unreleased = issuesGroupedByTag.unreleased ? createChangelogSection({ previousTag: tagNames[0], tag: null, issues: issuesGroupedByTag.unreleased }) : '';

  // WRITE complete changelog
  const changelogMarkdown = `# Change Log\n\n${[unreleased].concat(changelogSections).join('\n\n')}`;

  // SAVE changelog
  fs.writeFileSync(`${getRootFolderPath()}/${config.github.changelog.outputPath}`, changelogMarkdown);

  return changelogMarkdown;
};

x();
