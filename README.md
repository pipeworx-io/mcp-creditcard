# mcp-creditcard

Credit-card number validation MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `validate_card` | Validate a credit/debit card number (keyless, offline): Luhn (mod-10) checksum, detected card network (Visa/Mastercard/Amex/Discover/JCB/Diners/UnionPay/Maestro), and whether the length is valid for that network. Spaces/dashes are ignored. NOTE: this checks the number is well-formed — it does NOT verify the card is real/active/funded (that needs a payment processor). |
| `check_luhn` | Run a raw Luhn (mod-10) check-digit validation on any numeric string (cards, IMEI, national IDs, etc.). Returns whether the check digit is valid and what the correct check digit would be. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "creditcard": {
      "url": "https://gateway.pipeworx.io/creditcard/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Creditcard data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
