
    export type RemoteKeys = 'rule-editor/App';
    type PackageType<T> = T extends 'rule-editor/App' ? typeof import('rule-editor/App') :any;