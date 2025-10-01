import { env } from "./env"
import { createPublicClient, formatEther, Hex, http, parseAbi } from "viem"
import { mainnet } from "viem/chains"
import ObjectsToCsv from "objects-to-csv"
import { LlamaLockerAbi } from "./abi/LlamaLockerABI"

async function main() {
    const llamaAddress = "0xe127ce638293fa123be79c25782a5652581db234".toLowerCase() as Hex
    const yETHAddress = "0x09db87A538BD693E9d08544577d5cCfAA6373A48".toLowerCase() as Hex
    const ynETHxAddress = "0x657d9ABA1DBb59e53f9F3eCAA878447dCfC96dCb".toLowerCase() as Hex
    const lockerAddress = "0x99c3f30Bbc9137F6E917B03C74aEd8a4309B3E1b".toLowerCase() as Hex
    const abi = parseAbi([
        "function ownerOf(uint256 tokenId) view returns (address)",
        "function balanceOf(address addy) view returns (uint256)",
    ])

    // Create viem client
    const viem = createPublicClient({
        chain: mainnet,
        transport: http(env.RPC_URL),
    })

    // Get locker
    const locks = await viem.readContract({
        address: lockerAddress,
        abi: LlamaLockerAbi,
        functionName: "getLocks",
        blockNumber: env.BLOCK_NUMBER,
    })
    const lockedNftOwner = new Map<bigint, Hex>()
    for (const lock of locks) {
        lockedNftOwner.set(lock.tokenId, lock.owner)
    }

    // Fetch llama owner
    const llamaCount = 1111n
    const data: {
        tokenId: bigint
        isLocked: boolean
        owner: Hex
        yETHBalance: string
        yETHxBalance: string
    }[] = []
    const ownerBalances = new Map<Hex, { yETHBalance: string; yETHxBalance: string }>()

    for (let tokenId = 0n; tokenId < llamaCount; tokenId++) {
        // Check wether tokenId is locked
        let isLocked = true
        let owner = lockedNftOwner.get(tokenId)
        if (owner == null) {
            // Get the owner address
            owner = await viem.readContract({
                address: llamaAddress,
                abi: abi,
                functionName: "ownerOf",
                args: [BigInt(tokenId)],
                blockNumber: env.BLOCK_NUMBER,
            })
            isLocked = false
        }

        const balances = ownerBalances.get(owner)
        if (balances == undefined) {
            const [yETHBalanceResult, ynETHxBalanceResult] = await viem.multicall({
                contracts: [
                    {
                        address: yETHAddress,
                        abi,
                        functionName: "balanceOf",
                        args: [owner],
                    },
                    {
                        address: ynETHxAddress,
                        abi,
                        functionName: "balanceOf",
                        args: [owner],
                    },
                ],
                blockNumber: env.BLOCK_NUMBER,
            })
            let yETHBalance = "0"
            if (yETHBalanceResult.result) {
                yETHBalance = formatEther(yETHBalanceResult.result)
            }
            let yETHxBalance = "0"
            if (ynETHxBalanceResult.result) {
                yETHxBalance = formatEther(ynETHxBalanceResult.result)
            }
            console.log(`owner=${owner} yETHBalance=${yETHBalance} yETHxBalance=${yETHxBalance}`)
            ownerBalances.set(owner, { yETHBalance, yETHxBalance })
        }
        const balancesAfter = ownerBalances.get(owner)
        if (balancesAfter == undefined) {
            throw new Error(`owner=${owner} not defined`)
        }
        data.push({ tokenId, isLocked, owner, ...balancesAfter })
    }

    const csv = new ObjectsToCsv(data)
    await csv.toDisk(`./snapshot_${env.BLOCK_NUMBER}.csv`)
}

void main()
