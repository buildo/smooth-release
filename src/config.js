import fs from 'fs';
import { execSync } from 'child_process';
import t from 'tcomb';
import { merge } from 'lodash';

const getRootFolderPath = () => execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const relesorc = JSON.parse(fs.readFileSync(`${getRootFolderPath()}/.relesorc`));

const Config = t.interface({
  github: t.interface({
    token: t.maybe(t.String),
    changelog: t.interface({
      outputPath: t.maybe(t.String),
      ignore: t.maybe(t.list(t.String)),
      types: t.list(t.interface({
        title: t.String,
        labels: t.union([t.String, t.list(t.String)])
      }))
    })
  }),
  publish: t.maybe(t.interface({
    branch: t.maybe(t.String),
    inSyncWithRemote: t.maybe(t.Boolean)
  }))
});

const defaultConfig = {
  github: {
    changelog: {
      outputPath: './CHANGELOG.md'
    }
  },
  publish: {
    branch: 'master',
    inSyncWithRemote: true
  }
};

const config = merge(defaultConfig, relesorc);

export default Config(config);
