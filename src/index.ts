interface McpToolDefinition {
  name: string;
  description: string;
  /** Human-facing one-liner (fleet #1967). Optional; consumers fall back to
   *  description. Kept in step with shared/src/types.ts — scripts/lib/
   *  check-inlined-types.mjs reports drift at publish time. */
  summary?: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    anyOf?: Array<{ required: string[] }>;
    oneOf?: Array<{ required: string[] }>;
    allOf?: Array<{ required: string[] }>;
  };
  outputSchema?: Record<string, unknown>;
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Credit-card number validation MCP.
 *
 * Keyless, offline: Luhn (mod-10) check-digit validation + card-network
 * detection from IIN/BIN ranges + per-network length checks. No API, no key,
 * no data leaves the process. Validates the NUMBER only — it does not check
 * whether a card is real, active, or has funds (that needs a payment processor).
 */


// [network, test(digits) -> bool, valid lengths]
const NETWORKS: [string, (d: string) => boolean, number[]][] = [
  ['American Express', (d) => /^3[47]/.test(d), [15]],
  ['Diners Club', (d) => /^(36|38|30[0-5])/.test(d), [14, 16, 19]],
  ['JCB', (d) => { const n = +d.slice(0, 4); return n >= 3528 && n <= 3589; }, [16, 17, 18, 19]],
  ['Discover', (d) => /^(6011|65|64[4-9])/.test(d) || (() => { const n = +d.slice(0, 6); return n >= 622126 && n <= 622925; })(), [16, 17, 18, 19]],
  ['UnionPay', (d) => /^62/.test(d), [16, 17, 18, 19]],
  ['Maestro', (d) => /^(5018|5020|5038|6304|6759|676[1-3])/.test(d), [12, 13, 14, 15, 16, 17, 18, 19]],
  ['Mastercard', (d) => /^5[1-5]/.test(d) || (() => { const n = +d.slice(0, 4); return n >= 2221 && n <= 2720; })(), [16]],
  ['Visa', (d) => /^4/.test(d), [13, 16, 19]],
];

function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

const tools: McpToolExport['tools'] = [
  {
    name: 'validate_card',
    description:
      'Validate a credit/debit card number (keyless, offline): Luhn (mod-10) checksum, detected card network (Visa/Mastercard/Amex/Discover/JCB/Diners/UnionPay/Maestro), and whether the length is valid for that network. Spaces/dashes are ignored. NOTE: this checks the number is well-formed — it does NOT verify the card is real/active/funded (that needs a payment processor).',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'string', description: 'The card number, e.g. "4111 1111 1111 1111".' } },
      required: ['number'],
    },
  },
  {
    name: 'check_luhn',
    description: 'Run a raw Luhn (mod-10) check-digit validation on any numeric string (cards, IMEI, national IDs, etc.). Returns whether the check digit is valid and what the correct check digit would be.',
    inputSchema: {
      type: 'object',
      properties: { number: { type: 'string', description: 'A numeric string to Luhn-check.' } },
      required: ['number'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const raw = reqStr(args, 'number', '"4111111111111111"');
  const digits = raw.replace(/[\s-]/g, '');
  switch (name) {
    case 'validate_card': {
      if (!/^\d+$/.test(digits)) return { input: raw, valid: false, reason: 'Contains non-digit characters (after removing spaces/dashes).' };
      const net = NETWORKS.find(([, test]) => test(digits));
      const luhn = luhnValid(digits);
      const lengthOk = net ? net[2].includes(digits.length) : digits.length >= 12 && digits.length <= 19;
      return {
        input: raw,
        valid: luhn && lengthOk,
        luhn_valid: luhn,
        network: net ? net[0] : 'Unknown',
        length: digits.length,
        length_valid: lengthOk,
        reason: !luhn ? 'Fails the Luhn check digit.' : !lengthOk ? `Length ${digits.length} is not valid for ${net ? net[0] : 'this range'}.` : 'Passes Luhn and the length is valid for the detected network.',
        note: 'Well-formedness only — does not verify the card is real, active or funded.',
      };
    }
    case 'check_luhn': {
      if (!/^\d+$/.test(digits)) return { input: raw, valid: false, reason: 'Not a numeric string.' };
      const valid = luhnValid(digits);
      // correct check digit for the given body (all but last treated as payload)
      const body = digits.slice(0, -1);
      let sum = 0, alt = true;
      for (let i = body.length - 1; i >= 0; i--) { let n = body.charCodeAt(i) - 48; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
      const correct = (10 - (sum % 10)) % 10;
      return { input: raw, luhn_valid: valid, correct_check_digit: correct, given_check_digit: +digits.slice(-1) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function reqStr(args: Record<string, unknown>, key: string, ex: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${ex}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
