import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyStructuredOutputContract,
  buildStructuredOutputContract,
  extractSseStructuredContent,
  validateStructuredContent,
} from '../src/core/structured-output-contract.js'

function request(schema, extra = {}) {
  return {
    model: 'fcm',
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'result', schema, ...extra },
    },
  }
}

describe('structured output contract', () => {
  it('builds one immutable canonical contract and materializes independent provider bodies', () => {
    const body = request({
      type: 'object',
      required: ['answer'],
      additionalProperties: false,
      properties: { answer: { type: 'string' } },
    }, { strict: true })

    const contract = buildStructuredOutputContract(body)
    assert.equal(contract.ok, true)
    assert.equal(contract.kind, 'json_schema')
    assert.equal(contract.atomic, true)
    assert.equal(contract.strict, true)

    const first = applyStructuredOutputContract({ ...body, stream: false }, contract)
    const second = applyStructuredOutputContract({ ...body, stream: true }, contract)
    assert.deepEqual(first.response_format, body.response_format)
    assert.deepEqual(second.response_format, body.response_format)

    first.response_format.json_schema.schema.properties.answer.type = 'number'
    assert.equal(contract.schema.properties.answer.type, 'string')
    assert.equal(second.response_format.json_schema.schema.properties.answer.type, 'string')
  })

  it('fails closed on schema keywords and refs the central validator does not support', () => {
    const unsupported = buildStructuredOutputContract(request({
      type: 'string',
      format: 'email',
    }))
    assert.equal(unsupported.ok, false)
    assert.match(unsupported.error, /unsupported JSON Schema keyword/)

    const externalRef = buildStructuredOutputContract(request({
      $ref: 'https://example.com/schema.json',
    }))
    assert.equal(externalRef.ok, false)
    assert.match(externalRef.error, /only local JSON Pointer refs are supported/)
  })

  it('validates the requested machine contract without adding business semantics', () => {
    const contract = buildStructuredOutputContract(request({
      type: 'object',
      required: ['answer'],
      additionalProperties: false,
      properties: { answer: { type: 'string', minLength: 1 } },
    }))

    assert.deepEqual(validateStructuredContent(contract, '{"answer":"Berlin"}'), { ok: true })
    assert.equal(validateStructuredContent(contract, '{"answer":123}').ok, false)
    assert.equal(validateStructuredContent(contract, '{"answer":"ok","extra":1}').ok, false)
    assert.equal(validateStructuredContent(contract, '{not-json').ok, false)
  })

  it('rejects invalid schema boundaries before any provider attempt', () => {
    const invalidSchemas = [
      { type: 'string', minLength: -1 },
      { type: 'array', maxItems: 1.5 },
      { type: 'object', minProperties: -1 },
      { type: 'number', multipleOf: 0 },
      { type: ['string', 'string'] },
      { type: 'object', required: ['answer', 'answer'] },
      { enum: [] },
      { enum: ['x', 'x'] },
    ]
    for (const schema of invalidSchemas) {
      assert.equal(buildStructuredOutputContract(request(schema)).ok, false, JSON.stringify(schema))
    }
  })

  it('covers representative supported keyword boundaries', () => {
    const cases = [
      [{ type: 'string', minLength: 2, maxLength: 3, pattern: '^a' }, 'ab', true],
      [{ type: 'string', minLength: 2 }, 'a', false],
      [{ type: 'number', minimum: 2, maximum: 4, multipleOf: 2 }, 4, true],
      [{ type: 'number', exclusiveMinimum: 2 }, 2, false],
      [{ type: 'array', minItems: 1, maxItems: 2, uniqueItems: true, items: { type: 'integer' } }, [1, 2], true],
      [{ type: 'array', uniqueItems: true }, [1, 1], false],
      [{ type: 'object', minProperties: 1, maxProperties: 1, properties: { x: { type: 'boolean' } }, additionalProperties: false }, { x: true }, true],
      [{ allOf: [{ type: 'number' }, { minimum: 2 }] }, 1, false],
      [{ anyOf: [{ type: 'string' }, { type: 'number' }] }, 1, true],
      [{ oneOf: [{ type: 'number' }, { minimum: 0 }] }, 1, false],
      [{ not: { type: 'null' } }, null, false],
      [{ $defs: { answer: { type: 'string' } }, $ref: '#/$defs/answer' }, 'ok', true],
    ]
    for (const [schema, value, expected] of cases) {
      const contract = buildStructuredOutputContract(request(schema))
      assert.equal(contract.ok, true, JSON.stringify(schema))
      assert.equal(validateStructuredContent(contract, JSON.stringify(value)).ok, expected, JSON.stringify({ schema, value }))
    }
  })

  it('keeps validation deterministic across repeated contract materialization', () => {
    const body = request({
      type: 'object',
      required: ['answer'],
      properties: { answer: { enum: ['a', 'b', 'c'] } },
      additionalProperties: false,
    })
    const contract = buildStructuredOutputContract(body)
    for (let i = 0; i < 100; i += 1) {
      const providerBody = applyStructuredOutputContract({ ...body, attempt: i }, contract)
      assert.deepEqual(providerBody.response_format, body.response_format)
      const candidate = JSON.stringify({ answer: ['a', 'b', 'c'][i % 3] })
      assert.equal(validateStructuredContent(contract, candidate).ok, true)
    }
  })

  it('reconstructs structured content from buffered SSE before client commit', () => {
    const raw = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"ans' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'wer":"ok"}' } }] })}\n\n`,
      'data: [DONE]\n\n',
    ].join('')
    assert.equal(extractSseStructuredContent(raw), '{"answer":"ok"}')
  })
})
