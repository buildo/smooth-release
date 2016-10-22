import { find, findLast, every } from 'lodash';
import { github, getGithubOwnerAndRepo } from '../utils';
import config from '../config';

const getAllClosedIssues = async (acc = [], issues) => {
  if (!issues) {
    const firstPage = await github.issues.fetch({ state: 'closed' });
    return getAllClosedIssues(acc.concat(firstPage), firstPage);
  }

  if (issues.nextPage) {
    const nextPage = await issues.nextPage();
    return getAllClosedIssues(acc.concat(nextPage), nextPage);
  }

  return acc;
};

const getAllTags = async (acc = [], tags) => {
  if (!tags) {
    const firstPage = await github.tags.fetch();
    return getAllTags(acc.concat(firstPage), firstPage);
  }

  if (tags.nextPage) {
    const nextPage = await tags.nextPage();
    return getAllTags(acc.concat(nextPage), nextPage);
  }

  return acc;
};

const groupIssuesByTag = (closedIssues, tags) => {
  return closedIssues.reduce((issuesByTag, issue) => {
    const tag = findLast(tags, tag => tag.createdAt > issue.createdAt);

    if (tag) {
      return {
        ...issuesByTag,
        [tag]: (issuesByTag[tag] || []).concat(issue)
      };
    }

    return {
      ...issuesByTag,
      unreleased: issuesByTag.unreleased.concat(issue)
    };
  }, { unreleased: [] });
};

const groupIssuesByType = (issues, types) => {
  return issues.reduce((issuesByType, issue) => {
    const type = find(types, type => every(type.labels, label => find(issue.labels, { name: label })));

    if (type) {
      return {
        ...issuesByType,
        [type.title]: (issuesByType[type.title] || []).concat(issue)
      };
    }

    return {
      ...issuesByType,
      notBreakingFeatures: issuesByType.notBreakingFeatures.concat(issue)
    };
  }, { notBreakingFeatures: [] });
};

export default async () => {
  const closedIssues = await getAllClosedIssues();
  const tags = await getAllTags();

  const tagsWithCreatedAt = await Promise.all(tags.map(async tag => {
    const tagCommit = await github.commits(tag.commit.sha);
    return {
      ...tag,
      createdAt: tagCommit.author.date
    };
  }));


  // GROUP ISSUES BY TAG
  const issuesGroupedByTag = groupIssuesByTag(closedIssues, tagsWithCreatedAt);

  const createChangelogSection = (previousTag, tag, issues) => {
    const { types } = config.github.changelog;
    const { owner, repo } = getGithubOwnerAndRepo();
    const header = `
## [${tag || 'Unreleased'}](https://github.com/${owner}/${repo}/tree/${tag || 'HEAD'})
[Full Changelog](https://github.com/buildo/react-components/compare/${previousTag.name}...${tag || 'HEAD'})`;

    const issuesGroupedByType = groupIssuesByType(issues, types);
    const typeTitles = Object.keys(issuesGroupedByType);

    const content = typeTitles.reduce((acc, typeTitle) => {
      const issues = issuesGroupedByType[typeTitle].map(issue => `- ${issue.title} [#${issue.number}](${issue.url})`).join('\n');
      return `${acc}\n\n${typeTitle}\n\n${issues}`;
    }, '');

    return `${header}\n\n${content}`;
  };

  const tagNames = Object.keys(issuesGroupedByTag);

  const changelogSections = tagNames.map((tag, i) => {
    const tagIssues = issuesGroupedByTag[tag];
    const previousTag = tagNames[i + 1];

    return createChangelogSection(previousTag, tag, tagIssues);
  });

  const unreleased = createChangelogSection(tagNames[0], null, issuesGroupedByTag.unreleased);

  return `# Change Log\n\n${[unreleased].concat(changelogSections).join('\n\n')}`;
};
