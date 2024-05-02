/**
 * viem is a TypeScript interface for Ethereum that provides low-level stateless primitives for interacting with Ethereum. viem is focused on developer experience, stability, bundle size, and performance.
 *
 * Getting Started: https://viem.sh/docs/getting-started
 */
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

/**
 * Creates a Public Client with a given [Transport](https://viem.sh/docs/clients/intro) configured for a [Chain](https://viem.sh/docs/clients/chains).
 *
 * - Docs: https://viem.sh/docs/clients/public
 *
 * A Public Client is an interface to "public" [JSON-RPC API](https://ethereum.org/en/developers/docs/apis/json-rpc/) methods such as retrieving block numbers, transactions, reading from smart contracts, etc through [Public Actions](/docs/actions/public/introduction).
 */
export const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.ETH_RPC),
});
