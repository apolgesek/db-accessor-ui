import groupBy from 'lodash.groupby';
import { AwsAccountsResponse } from './models';

export function accountRegions(data: AwsAccountsResponse, accountId: string | null) {
  // No global-catalog fallback: only regions enabled in this account are selectable.
  return accountId ? data.regionsByAccount?.[accountId] ?? [] : [];
}

export function accountRegionOptions(data: AwsAccountsResponse, accountId: string | null) {
  const options = accountRegions(data, accountId).map((region) => ({
    value: region.code,
    label: region.longName,
  }));
  return groupBy(options, (option) => option.label.split('(')[0].trim());
}
