/**
 * - Docs: https://github.com/Effect-TS/effect/blob/main/packages/schema/README.md
 */
import * as S from '@effect/schema/Schema';
export const TransactionArgs = S.Struct({
  from: S.String,
  to: S.String,
  tokenId: S.BigIntFromSelf,
});
export const TransactionLog = S.Struct({
  args: TransactionArgs,
  eventName: S.String,
  address: S.String,
  blockNumber: S.BigIntFromSelf,
});
export interface TransactionLog extends S.Schema.Type<typeof TransactionLog> {}
export const decode = S.decodeUnknownSync(TransactionLog);
