
    export type RemoteKeys = 'simulator/App';
    type PackageType<T> = T extends 'simulator/App' ? typeof import('simulator/App') :any;