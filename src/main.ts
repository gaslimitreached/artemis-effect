import { BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";
import { EventLogPubSub } from "./event-pubsub";
import { ViemService } from "./viem-service";

const MainLive = Layer.provide(
  Layer.mergeAll(ViemService),
  EventLogPubSub.Live
);

BunRuntime.runMain(Layer.launch(MainLive));
