/**
 *  Services to provide capabilities that can be shared across modules
 *
 * - Docs: https://effect.website/docs/guides/context-management/services
 */
import { Stream, Context } from 'effect';
import { TransactionLog } from './transaction-log';

export class Blocks extends Context.Tag('Blocks')<
  Blocks,
  { readonly stream: Stream.Stream<bigint> }
>() {}

export class EventLogs extends Context.Tag('EventLogs')<
  EventLogs,
  { readonly stream: Stream.Stream<TransactionLog> }
>() {}
