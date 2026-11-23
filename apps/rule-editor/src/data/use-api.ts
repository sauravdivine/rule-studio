import { useMemo } from 'react';
import type { HostProps } from '@rule-studio/host';
import { rulesetsApi } from './api';

export const useRulesetsApi = (host: HostProps['host']) =>
  useMemo(() => rulesetsApi(host.api), [host.api]);

// What the signed-in user may do, from the host (spec 002).
export function usePermissions(host: HostProps['host']) {
  return {
    canEdit: host.can('ruleset:edit'),
    canPublish: host.can('ruleset:publish'),
    canPin: host.can('ruleset:pin'),
    canArchive: host.can('ruleset:archive'),
  };
}
