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

  it('reconstructs structured content from buffered SSE before client commit', () => {
    const raw = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: '{"ans' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'wer":"ok"}' } }] })}\n\n`,
      'data: [DONE]\n\n',
    ].join('')
    assert.equal(extractSseStructuredContent(raw), '{"answer":"ok"}')
  })
})
