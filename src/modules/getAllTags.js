import { github } from '../utils';

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

export default async () => {
  return await getAllTags();
};
