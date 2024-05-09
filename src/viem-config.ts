import { Config, Context, Effect, Layer } from "effect";

const make = Effect.gen(function* () {
  const rpc = yield* Config.string("ETH_RPC").pipe(
    Config.withDefault("https://eth.llamarpc.com")
  );
  return {
    rpc,
  } as const;
});

export class ViemConfig extends Context.Tag("config/viem")<
  ViemConfig,
  Effect.Effect.Success<typeof make>
>() {
  static Live = Layer.effect(this, make);
}
