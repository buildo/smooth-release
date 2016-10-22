import t from 'tcomb';
import { merge } from 'lodash';
import configJson from '../config.json';

const Config = t.interface({
  github: t.interface({
    token: t.String,
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

const config = merge(defaultConfig, configJson);

export default Config(config);
