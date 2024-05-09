import {
  Chunk,
  Context,
  Console,
  Data,
  Effect,
  Layer,
  Queue,
  Stream,
  StreamEmit,
} from "effect";

import { createPublicClient, http, type PublicClient } from "viem";
import { mainnet } from "viem/chains";

import { ViemConfig } from "./viem-config";
import { EventLog, EventLogPubSub, TokenMintEvent } from "./event-pubsub";

export class ViemError extends Data.TaggedError("ViemError")<{
  cause: unknown;
}> {}

export class ViemProvider extends Context.Tag("provider/viem")<
  ViemProvider,
  PublicClient
>() {
  static Live = Layer.effect(
    this,
    Effect.map(ViemConfig, (config) => {
      return createPublicClient({
        chain: mainnet,
        transport: http(config.rpc),
      });
    })
  ).pipe(Layer.provide(ViemConfig.Live));
}

const make = Effect.gen(function* () {
  const client = yield* ViemProvider;
  const use = <A>(f: (client: PublicClient) => Promise<A>) =>
    Effect.tryPromise({
      try: () => f(client),
      catch: (error) => new ViemError({ cause: error }),
    });

  const watchBlockNumber = Stream.async(
    (emit: StreamEmit.Emit<never, never, bigint, void>) => {
      client.watchBlockNumber({
        onBlockNumber: (n: bigint) => emit(Effect.succeed(Chunk.of(n))),
      });
    }
  );

  const watchTokenMints = Stream.async(
    (emit: StreamEmit.Emit<never, never, TokenMintEvent, void>) => {
      client.watchEvent({
        args: { from: "0x0000000000000000000000000000000000000000" },
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { type: "address", indexed: true, name: "from" },
            { type: "address", indexed: true, name: "to" },
            { type: "uint256", indexed: true, name: "tokenId" },
          ],
        },
        onLogs: (logs) => {
          logs.flatMap((log: any) =>
            emit(Effect.succeed(Chunk.of(log as TokenMintEvent)))
          );
        },
      });
    }
  );

  return { client, use, watchBlockNumber, watchTokenMints } as const;
});

export class Viem extends Context.Tag("service/viem")<
  Viem,
  Effect.Effect.Success<typeof make>
>() {
  static Live = Layer.effect(this, make).pipe(Layer.provide(ViemProvider.Live));
}

const ViemClientsLive = Layer.mergeAll(ViemProvider.Live, Viem.Live);

export const ViemService = Layer.scopedDiscard(
  Effect.gen(function* () {
    const viem = yield* Viem;
    const pubsub = yield* EventLogPubSub;

    const dequeue = yield* pubsub.subscribeTo("TokenMintEvent");

    yield* Effect.gen(function* () {
      yield* Effect.logInfo("waiting for events");
      const event = yield* Queue.take(dequeue);
      yield* Console.log(event);
      yield* Effect.logInfo("received event");
    }).pipe(Effect.forever, Effect.forkDaemon);

    const blocks = viem.watchBlockNumber.pipe(
      Stream.tap(Effect.log),
      Stream.runDrain
    );
    yield* Effect.forkDaemon(blocks);

    const mints = viem.watchTokenMints.pipe(
      Stream.tap(({ address, args: { tokenId } }) =>
        Effect.log(address, tokenId)
      ),
      Stream.mapEffect((log) => pubsub.publish(EventLog.TokenMintEvent(log))),
      Stream.runDrain
    );

    yield* Effect.forkDaemon(mints);
  })
).pipe(Layer.provide(Layer.mergeAll(ViemClientsLive)));
