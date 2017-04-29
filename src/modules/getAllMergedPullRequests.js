import { github } from '../utils';

const getAllMergedPullRequests = async (acc = [], pullRequests) => {
  if (!pullRequests) {
    const firstPage = await github.pulls.fetch({ state: 'closed', limit: 100 });
    return getAllMergedPullRequests(acc.concat(firstPage), firstPage);
  } else if (pullRequests.nextPage) {
    const nextPage = await pullRequests.nextPage();
    return getAllMergedPullRequests(acc.concat(nextPage), nextPage);
  } else {
    return acc.filter(pr => pr.mergedAt); // filter out cloused-without-merge PRs
  }
};

export default async () => {
  return getAllMergedPullRequests();
};
