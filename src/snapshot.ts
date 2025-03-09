import { env } from "./env"

async function main() {
    console.log("DEBUG: blockNumber", env.BLOCK_NUMBER)
}

void main()
