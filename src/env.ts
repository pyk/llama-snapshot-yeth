import { config } from "dotenv"
import { z } from "zod"

// Load .env
config()

const EnvSchema = z.object({
    BLOCK_NUMBER: z
        .string({ message: "BLOCK_NUMBER undefined" })
        .transform((x) => BigInt(x)),
})

export const env = EnvSchema.parse(process.env)
