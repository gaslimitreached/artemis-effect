import { Effect, Ref } from "effect"

export class BlockTracker {
  set: (n: bigint) => Effect.Effect<void>
  get: Effect.Effect<bigint>
  constructor(private value: Ref.Ref<bigint>) {
    this.set = (n: bigint) => Ref.set(this.value, n)
    this.get = Ref.get(this.value)
  }
}

export const make = Effect.map(Ref.make(BigInt(0)), (value) => new BlockTracker(value))
