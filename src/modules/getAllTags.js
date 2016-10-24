import { github, log } from '../utils';

let tags = null;

const getAllTags = async (acc = [], tags) => {
  !tags && log('Getting tags');
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

export default async () => {
  tags = tags || await getAllTags();
  return tags;
};
