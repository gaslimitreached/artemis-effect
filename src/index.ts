/**
 * effect: A fully-fledged functional effect system for TypeScript with a rich standard library
 *
 * Quick start: https://effect.website/docs/quickstart
 *
 * GitHub: https://github.com/Effect-TS/effect
 */
import { NodeRuntime } from '@effect/platform-node';
import { Effect, Stream, StreamEmit, Chunk, Sink } from 'effect';

import { Blocks, EventLogs } from './services';
import * as TransactionLog from './transaction-log';
import { client } from './viem-client';

/**
 * Write our main program
 *
 * Docs - https://effect.website/docs/guides/essentials/using-generators#understanding-effectgen
 */
const program = Effect.gen(function* ($) {
  const blocks = yield* Blocks;
  const logs = yield* EventLogs;

  /**
   * Listen for event logs
   *
   * Docs - https://effect.website/docs/guides/streaming/stream/introduction
   *
   * @todo cache https://effect.website/docs/guides/batching-caching#using-cache-directly
   */
  const listener = logs.stream.pipe(
    Stream.changes,
    Stream.tap(({ address, args: { tokenId } }) =>
      Effect.log(address, tokenId)
    ),
    Stream.merge(blocks.stream.pipe(Stream.tap(Effect.log))),
    Stream.run(Sink.drain)
  );

  yield* listener;
});

/**
 * Provide implementations for multiple services
 *
 * Docs - https://effect.website/docs/guides/context-management/services#using-multiple-services
 */
const runnable = program.pipe(
  Effect.provideService(Blocks, {
    stream: Stream.async(
      (emit: StreamEmit.Emit<never, never, bigint, void>) => {
        /**
         * Watches and returns incoming block numbers.
         *
         * - Docs: https://viem.sh/docs/actions/public/watchBlockNumber
         * - Examples: https://stackblitz.com/github/wevm/viem/tree/main/examples/blocks/watching-blocks
         * - JSON-RPC Methods:
         *   - When `poll: true`, calls [`eth_blockNumber`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_blocknumber) on a polling interval.
         *   - When `poll: false` & WebSocket Transport, uses a WebSocket subscription via [`eth_subscribe`](https://docs.alchemy.com/reference/eth-subscribe-polygon) and the `"newHeads"` event.
         */
        client.watchBlockNumber({
          onBlockNumber: (n: bigint) => emit(Effect.succeed(Chunk.of(n))),
        });
      }
    ),
  }),

  Effect.provideService(EventLogs, {
    stream: Stream.async((emit: StreamEmit.Emit<never, never, any, void>) => {
      /**
       * Watches and returns emitted [Event Logs](https://viem.sh/docs/glossary/terms#event-log).
       *
       * - Docs: https://viem.sh/docs/actions/public/watchEvent
       * - JSON-RPC Methods:
       *   - **RPC Provider supports `eth_newFilter`:**
       *     - Calls [`eth_newFilter`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_newfilter) to create a filter (called on initialize).
       *     - On a polling interval, it will call [`eth_getFilterChanges`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getfilterchanges).
       *   - **RPC Provider does not support `eth_newFilter`:**
       *     - Calls [`eth_getLogs`](https://ethereum.org/en/developers/docs/apis/json-rpc/#eth_getlogs) for each block between the polling interval.
       *
       * This Action will batch up all the Event Logs found within the [`pollingInterval`](https://viem.sh/docs/actions/public/watchEvent#pollinginterval-optional), and invoke them via [`onLogs`](https://viem.sh/docs/actions/public/watchEvent#onLogs).
       *
       * `watchEvent` will attempt to create an [Event Filter](https://viem.sh/docs/actions/public/createEventFilter) and listen to changes to the Filter per polling interval, however, if the RPC Provider does not support Filters (e.g. `eth_newFilter`), then `watchEvent` will fall back to using [`getLogs`](https://viem.sh/docs/actions/public/getLogs) instead.
       */
      client.watchEvent({
        args: { from: '0x0000000000000000000000000000000000000000' },
        event: {
          type: 'event',
          name: 'Transfer',
          inputs: [
            { type: 'address', indexed: true, name: 'from' },
            { type: 'address', indexed: true, name: 'to' },
            { type: 'uint256', indexed: true, name: 'tokenId' },
          ],
        },
        onLogs: (logs) => {
          logs.flatMap((log: any) =>
            emit(Effect.succeed(Chunk.of(TransactionLog.decode(log))))
          );
        },
      });
    }),
  })
);

NodeRuntime.runMain(Effect.scoped(runnable));
