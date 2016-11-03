import { github } from '../utils';

let tags = null;

const getAllTags = async (acc = [], tags) => {
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

export default async (forceRefresh) => {
  tags = (tags && !forceRefresh) ? tags : await getAllTags();
  return tags;
};
