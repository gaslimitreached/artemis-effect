import {
  Console,
  Context,
  Data,
  Effect,
  Layer,
  PubSub,
  Queue,
  Scope,
} from "effect";
import { Address } from "viem";

export type EventLog = Data.TaggedEnum<{
  TokenMintEvent: {
    address: Address;
    args: {
      from: Address;
      to: Address;
      tokenId: bigint;
    };
  };
}>;

export type TokenMintEvent = Extract<EventLog, { _tag: "TokenMintEvent" }>;

export type EventLogType = EventLog["_tag"];

export const EventLog = Data.taggedEnum<EventLog>();

type EventTypeToEvent = {
  TokenMintEvent: TokenMintEvent;
};

export class EventLogPubSub extends Context.Tag("eventlog-pubsub")<
  EventLogPubSub,
  Readonly<{
    publish: (log: EventLog) => Effect.Effect<boolean>;
    subscribe: Effect.Effect<Queue.Dequeue<EventLog>, never, Scope.Scope>;
    subscribeTo: <T extends EventLogType>(
      eventType: T
    ) => Effect.Effect<Queue.Dequeue<EventTypeToEvent[T]>, never, Scope.Scope>;
  }>
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const pubsub: PubSub.PubSub<EventLog> = yield* Effect.acquireRelease(
        PubSub.unbounded<EventLog>(),
        (queue) =>
          Effect.gen(function* () {
            yield* Effect.log("stopped event log subscription");
            return PubSub.shutdown(queue);
          })
      );

      yield* Effect.logInfo("started event log subscription");

      return EventLogPubSub.of({
        publish: pubsub.publish,
        subscribe: pubsub.subscribe,
        subscribeTo: <T extends EventLogType>(eventType: T) =>
          Effect.gen(function* () {
            yield* Effect.logInfo(`received subscription for ${eventType}`);
            const queue = yield* Effect.acquireRelease(
              Queue.unbounded<EventTypeToEvent[T]>(),
              (queue) =>
                Queue.shutdown(queue).pipe(() =>
                  Effect.logInfo("dequeue stopped")
                )
            );

            yield* Effect.logInfo(`dequeue starting for ${eventType}`);
            const subscription = yield* PubSub.subscribe(pubsub);

            function predicate(event: EventLog): event is EventTypeToEvent[T] {
              return event._tag === eventType;
            }

            yield* Effect.gen(function* () {
              const event = yield* subscription.take;
              yield* Console.log("made it", event);
              if (predicate(event)) {
                yield* Queue.offer(queue, event);
              }
            }).pipe(Effect.forever, Effect.forkScoped);

            yield* Effect.addFinalizer(() =>
              Effect.logInfo(`consumer for ${eventType} ending`)
            );

            return queue;
          }),
      });
    })
  );
}
