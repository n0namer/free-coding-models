/**
 * Central structured-output contract for FCM routing.
 *
 * Build once from the client request, reuse for every upstream attempt, and
 * validate provider-independent acceptance before client commit.
 */

const ALLOWED_SCHEMA_KEYS = new Set([
  '$schema', '$id', '$defs', 'definitions', '$ref',
  'title', 'description', 'default', 'examples',
  'type', 'enum', 'const', 'allOf', 'anyOf', 'oneOf', 'not',
  'properties', 'required', 'additionalProperties',
  'items', 'prefixItems',
  'minLength', 'maxLength',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minItems', 'maxItems', 'uniqueItems',
  'minProperties', 'maxProperties',
])

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function fail(error) {
  return { ok: false, error }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((entry, index) => deepEqual(entry, b[index]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]))
  }
  return false
}

function validateSchemaDefinition(schema, path = 'schema', seen = new Set()) {
  if (schema === true || schema === false) return { ok: true }
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return fail(`${path}: schema node must be an object or boolean`)
  if (seen.has(schema)) return { ok: true }
  seen.add(schema)

  for (const key of Object.keys(schema)) {
    if (!ALLOWED_SCHEMA_KEYS.has(key)) return fail(`${path}: unsupported JSON Schema keyword "${key}"`)
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const allowedTypes = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string'])
    if (types.length === 0 || types.some((type) => !allowedTypes.has(type))) return fail(`${path}.type: unsupported type`)
  }
  if (schema.required !== undefined && (!Array.isArray(schema.required) || schema.required.some((key) => typeof key !== 'string'))) {
    return fail(`${path}.required: must be an array of strings`)
  }
  if (schema.enum !== undefined && !Array.isArray(schema.enum)) return fail(`${path}.enum: must be an array`)
  if (schema.$ref !== undefined) {
    if (typeof schema.$ref !== 'string') return fail(`${path}.$ref: must be a string`)
    if (!schema.$ref.startsWith('#/')) return fail(`${path}.$ref: only local JSON Pointer refs are supported`)
  }

  const numericKeywords = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']
  for (const key of numericKeywords) {
    if (schema[key] !== undefined && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))) {
      return fail(`${path}.${key}: must be a finite number`)
    }
  }
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties', 'maxProperties']) {
    if (schema[key] !== undefined && (!Number.isInteger(schema[key]) || schema[key] < 0)) {
      return fail(`${path}.${key}: must be a non-negative integer`)
    }
  }
  if (schema.multipleOf !== undefined && (typeof schema.multipleOf !== 'number' || !Number.isFinite(schema.multipleOf) || schema.multipleOf <= 0)) {
    return fail(`${path}.multipleOf: must be a finite number greater than 0`)
  }
  if (Array.isArray(schema.type) && new Set(schema.type).size !== schema.type.length) {
    return fail(`${path}.type: duplicate types are not allowed`)
  }
  if (Array.isArray(schema.required) && new Set(schema.required).size !== schema.required.length) {
    return fail(`${path}.required: duplicate property names are not allowed`)
  }
  if (Array.isArray(schema.enum)) {
    if (schema.enum.length === 0) return fail(`${path}.enum: must not be empty`)
    for (let i = 0; i < schema.enum.length; i += 1) {
      for (let j = i + 1; j < schema.enum.length; j += 1) {
        if (deepEqual(schema.enum[i], schema.enum[j])) return fail(`${path}.enum: duplicate values are not allowed`)
      }
    }
  }
  for (const key of ['properties', '$defs', 'definitions']) {
    if (schema[key] === undefined) continue
    if (!schema[key] || typeof schema[key] !== 'object' || Array.isArray(schema[key])) return fail(`${path}.${key}: must be an object`)
    for (const [name, child] of Object.entries(schema[key])) {
      const result = validateSchemaDefinition(child, `${path}.${key}.${name}`, seen)
      if (!result.ok) return result
    }
  }

  for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
    if (schema[key] === undefined) continue
    if (!Array.isArray(schema[key])) return fail(`${path}.${key}: must be an array`)
    for (let index = 0; index < schema[key].length; index += 1) {
      const result = validateSchemaDefinition(schema[key][index], `${path}.${key}[${index}]`, seen)
      if (!result.ok) return result
    }
  }

  for (const key of ['not', 'items']) {
    if (schema[key] === undefined) continue
    const result = validateSchemaDefinition(schema[key], `${path}.${key}`, seen)
    if (!result.ok) return result
  }
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') {
    const result = validateSchemaDefinition(schema.additionalProperties, `${path}.additionalProperties`, seen)
    if (!result.ok) return result
  }

  return { ok: true }
}

function resolveLocalRef(root, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('#/')) return null
  let node = root
  for (const raw of pointer.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (!node || typeof node !== 'object' || !(key in node)) return null
    node = node[key]
  }
  return node
}

function typeMatches(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  return typeof value === type
}

function validateValue(value, schema, root = schema, path = 'root', depth = 0) {
  if (depth > 64) return fail(`${path}: schema recursion limit exceeded`)
  if (schema === true) return { ok: true }
  if (schema === false) return fail(`${path}: rejected by false schema`)
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return fail(`${path}: invalid schema node`)

  if (schema.$ref !== undefined) {
    const target = resolveLocalRef(root, schema.$ref)
    if (!target) return fail(`${path}: unresolved or non-local $ref "${schema.$ref}"`)
    const result = validateValue(value, target, root, path, depth + 1)
    if (!result.ok) return result
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) return fail(`${path}: const mismatch`)
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => deepEqual(entry, value))) return fail(`${path}: enum mismatch`)

  if (Array.isArray(schema.allOf)) {
    for (const child of schema.allOf) {
      const result = validateValue(value, child, root, path, depth + 1)
      if (!result.ok) return result
    }
  }
  if (Array.isArray(schema.anyOf) && !schema.anyOf.some((child) => validateValue(value, child, root, path, depth + 1).ok)) return fail(`${path}: anyOf mismatch`)
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((child) => validateValue(value, child, root, path, depth + 1).ok).length
    if (matches !== 1) return fail(`${path}: oneOf matched ${matches} branches`)
  }
  if (schema.not && validateValue(value, schema.not, root, path, depth + 1).ok) return fail(`${path}: matched forbidden schema`)

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!types.some((type) => typeMatches(value, type))) return fail(`${path}: expected type ${types.join('|')}`)
  }

  if (typeof value === 'string') {
    const length = [...value].length
    if (schema.minLength !== undefined && length < schema.minLength) return fail(`${path}: shorter than minLength`)
    if (schema.maxLength !== undefined && length > schema.maxLength) return fail(`${path}: longer than maxLength`)
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) return fail(`${path}: pattern mismatch`)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) return fail(`${path}: below minimum`)
    if (schema.maximum !== undefined && value > schema.maximum) return fail(`${path}: above maximum`)
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) return fail(`${path}: below exclusiveMinimum`)
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) return fail(`${path}: above exclusiveMaximum`)
    if (schema.multipleOf !== undefined) {
      if (schema.multipleOf <= 0) return fail(`${path}: multipleOf must be > 0`)
      const quotient = value / schema.multipleOf
      if (Math.abs(quotient - Math.round(quotient)) > 1e-12) return fail(`${path}: not a multipleOf ${schema.multipleOf}`)
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return fail(`${path}: fewer than minItems`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return fail(`${path}: more than maxItems`)
    if (schema.uniqueItems === true) {
      for (let i = 0; i < value.length; i += 1) {
        for (let j = i + 1; j < value.length; j += 1) {
          if (deepEqual(value[i], value[j])) return fail(`${path}: duplicate array items`)
        }
      }
    }
    if (Array.isArray(schema.prefixItems)) {
      for (let i = 0; i < Math.min(value.length, schema.prefixItems.length); i += 1) {
        const result = validateValue(value[i], schema.prefixItems[i], root, `${path}[${i}]`, depth + 1)
        if (!result.ok) return result
      }
    }
    if (schema.items !== undefined) {
      const start = Array.isArray(schema.prefixItems) ? schema.prefixItems.length : 0
      for (let i = start; i < value.length; i += 1) {
        const result = validateValue(value[i], schema.items, root, `${path}[${i}]`, depth + 1)
        if (!result.ok) return result
      }
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value)
    if (schema.minProperties !== undefined && keys.length < schema.minProperties) return fail(`${path}: fewer than minProperties`)
    if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) return fail(`${path}: more than maxProperties`)
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
    for (const key of schema.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) return fail(`${path}.${key}: required property missing`)
    }
    for (const [key, child] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue
      const result = validateValue(value[key], child, root, `${path}.${key}`, depth + 1)
      if (!result.ok) return result
    }
    if (schema.additionalProperties === false) {
      for (const key of keys) if (!Object.prototype.hasOwnProperty.call(properties, key)) return fail(`${path}.${key}: additional property not allowed`)
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(properties, key)) continue
        const result = validateValue(value[key], schema.additionalProperties, root, `${path}.${key}`, depth + 1)
        if (!result.ok) return result
      }
    }
  }

  return { ok: true }
}

export function buildStructuredOutputContract(body) {
  const responseFormat = body?.response_format
  if (!responseFormat || typeof responseFormat !== 'object' || Array.isArray(responseFormat)) {
    return Object.freeze({ ok: true, kind: 'none', atomic: false, responseFormat: null })
  }

  if (responseFormat.type === 'json_object') {
    return Object.freeze({ ok: true, kind: 'json_object', atomic: true, responseFormat: cloneJson(responseFormat) })
  }
  if (responseFormat.type !== 'json_schema') {
    return Object.freeze({ ok: true, kind: 'none', atomic: false, responseFormat: null })
  }

  const jsonSchema = responseFormat.json_schema
  if (!jsonSchema || typeof jsonSchema !== 'object' || Array.isArray(jsonSchema)) {
    return Object.freeze({ ok: false, kind: 'json_schema', atomic: true, error: 'response_format.json_schema must be an object' })
  }
  if (typeof jsonSchema.name !== 'string' || !jsonSchema.name.trim()) {
    return Object.freeze({ ok: false, kind: 'json_schema', atomic: true, error: 'response_format.json_schema.name must be a non-empty string' })
  }
  const schema = jsonSchema.schema
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return Object.freeze({ ok: false, kind: 'json_schema', atomic: true, error: 'response_format.json_schema.schema must be an object' })
  }

  const schemaCheck = validateSchemaDefinition(schema)
  if (!schemaCheck.ok) return Object.freeze({ ok: false, kind: 'json_schema', atomic: true, error: schemaCheck.error })

  return Object.freeze({
    ok: true,
    kind: 'json_schema',
    atomic: true,
    name: jsonSchema.name,
    strict: jsonSchema.strict === true,
    schema: cloneJson(schema),
    responseFormat: cloneJson(responseFormat),
  })
}

export function applyStructuredOutputContract(body, contract) {
  if (!body || typeof body !== 'object' || !contract || contract.kind === 'none') return body
  return { ...body, response_format: cloneJson(contract.responseFormat) }
}

export function validateStructuredContent(contract, content) {
  if (!contract || contract.kind !== 'json_schema') return { ok: true }
  if (!contract.ok) return fail(contract.error || 'invalid structured output contract')
  if (typeof content !== 'string' || !content.trim()) return fail('structured response content is missing')
  let value
  try { value = JSON.parse(content) } catch { return fail('structured response is not valid JSON') }
  return validateValue(value, contract.schema)
}

function normalizeContentParts(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((part) => typeof part === 'string' ? part : (typeof part?.text === 'string' ? part.text : '')).join('')
  return null
}

export function extractCompletionStructuredContents(payload) {
  if (!Array.isArray(payload?.choices)) return []
  return payload.choices.map((choice) => normalizeContentParts(choice?.message?.content))
}

export function extractCompletionStructuredContent(payload) {
  return extractCompletionStructuredContents(payload)[0] ?? null
}

export function extractSseStructuredContents(raw) {
  const byChoice = new Map()
  for (const frame of String(raw || '').replace(/\r\n/g, '\n').split('\n\n')) {
    const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
    if (!data || data === '[DONE]') continue
    try {
      const payload = JSON.parse(data)
      const choices = Array.isArray(payload?.choices) ? payload.choices : []
      for (let position = 0; position < choices.length; position += 1) {
        const choice = choices[position]
        const key = Number.isInteger(choice?.index) ? choice.index : position
        const delta = normalizeContentParts(choice?.delta?.content)
        if (typeof delta === 'string') byChoice.set(key, (byChoice.get(key) || '') + delta)
      }
    } catch {
      // SSE framing/lifecycle validation remains router-daemon's responsibility.
    }
  }
  return [...byChoice.entries()].sort(([a], [b]) => a - b).map(([, content]) => content)
}

export function extractSseStructuredContent(raw) {
  return extractSseStructuredContents(raw)[0] ?? null
}

function validateStructuredChoices(contract, contents) {
  if (!Array.isArray(contents) || contents.length === 0) return fail('structured response content is missing')
  for (let index = 0; index < contents.length; index += 1) {
    const result = validateStructuredContent(contract, contents[index])
    if (!result.ok) return fail(`choice[${index}]: ${result.error}`)
  }
  return { ok: true }
}

export function validateCompletionAgainstStructuredContract(contract, payload) {
  if (!contract || contract.kind !== 'json_schema') return { ok: true }
  return validateStructuredChoices(contract, extractCompletionStructuredContents(payload))
}

export function validateSseAgainstStructuredContract(contract, raw) {
  if (!contract || contract.kind !== 'json_schema') return { ok: true }
  return validateStructuredChoices(contract, extractSseStructuredContents(raw))
}

export function validateStructuredValueAgainstContract(contract, value) {
  if (!contract || contract.kind !== 'json_schema') return { ok: true }
  if (!contract.ok) return fail(contract.error || 'invalid structured output contract')
  return validateValue(value, contract.schema)
}

function schemaHasUnsafeRepairRef(schema) {
  if (!schema || typeof schema !== 'object') return false
  if (Array.isArray(schema)) return schema.some(schemaHasUnsafeRepairRef)
  if (typeof schema.$ref === 'string' && !schema.$ref.startsWith('#/$defs/') && !schema.$ref.startsWith('#/definitions/')) return true
  return Object.values(schema).some(schemaHasUnsafeRepairRef)
}

function repairObjectSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false
  if (schema.$ref || schema.allOf || schema.anyOf || schema.oneOf || schema.not) return false
  const types = schema.type === undefined ? [] : (Array.isArray(schema.type) ? schema.type : [schema.type])
  if (types.length > 0 && !types.includes('object')) return false
  const properties = schema.properties
  const required = Array.isArray(schema.required) ? schema.required : []
  if (!properties || typeof properties !== 'object' || Array.isArray(properties) || required.length === 0) return false
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(properties, key))) return false
  if (schema.minProperties !== undefined && schema.minProperties > required.length) return false
  return true
}

function defineRepairKey(target, key, value) {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: true, writable: true })
}

function setRepairPath(target, path, value) {
  let cursor = target
  for (let index = 0; index < path.length - 1; index += 1) {
    const key = path[index]
    const existing = Object.prototype.hasOwnProperty.call(cursor, key) ? cursor[key] : null
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      const next = {}
      defineRepairKey(cursor, key, next)
      cursor = next
    } else {
      cursor = existing
    }
  }
  defineRepairKey(cursor, path[path.length - 1], cloneJson(value))
}

function collectRepairNeeds({ schema, draft, root, path = [], depth = 0, maxDepth = 2, seed, needed, reused }) {
  const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties) ? schema.properties : {}
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  const draftObject = draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : null

  for (const [key, propertySchema] of Object.entries(properties)) {
    if (schemaHasUnsafeRepairRef(propertySchema)) return fail('repair skips property refs outside $defs/definitions')
    const childPath = [...path, key]
    const hasDraftValue = Boolean(draftObject && Object.prototype.hasOwnProperty.call(draftObject, key))
    if (hasDraftValue) {
      const check = validateValue(draftObject[key], propertySchema, root, `root.${childPath.join('.')}`)
      if (check.ok) {
        setRepairPath(seed, childPath, draftObject[key])
        reused.count += 1
        continue
      }
    }

    if (!required.has(key)) continue
    const childDraft = hasDraftValue && draftObject[key] && typeof draftObject[key] === 'object' && !Array.isArray(draftObject[key]) ? draftObject[key] : null
    if (depth < maxDepth && repairObjectSchema(propertySchema)) {
      const nested = collectRepairNeeds({ schema: propertySchema, draft: childDraft, root, path: childPath, depth: depth + 1, maxDepth, seed, needed, reused })
      if (!nested.ok) return nested
      continue
    }
    needed.push({ path: childPath, schema: cloneJson(propertySchema) })
  }
  return { ok: true }
}

function buildRepairFragmentSchema(entries, rootSchema) {
  const leaf = Symbol('repair-leaf')
  const tree = Object.create(null)
  for (const entry of entries) {
    let cursor = tree
    for (let index = 0; index < entry.path.length; index += 1) {
      const key = entry.path[index]
      if (!Object.prototype.hasOwnProperty.call(cursor, key)) defineRepairKey(cursor, key, Object.create(null))
      if (index === entry.path.length - 1) cursor[key][leaf] = entry.schema
      cursor = cursor[key]
    }
  }

  function render(node) {
    const properties = Object.create(null)
    const required = []
    for (const key of Object.keys(node)) {
      const child = node[key]
      required.push(key)
      defineRepairKey(properties, key, child[leaf] ? cloneJson(child[leaf]) : render(child))
    }
    return { type: 'object', properties, required, additionalProperties: false }
  }

  return {
    ...render(tree),
    ...(rootSchema.$defs ? { $defs: cloneJson(rootSchema.$defs) } : {}),
    ...(rootSchema.definitions ? { definitions: cloneJson(rootSchema.definitions) } : {}),
  }
}

export function mergeStructuredRepairFragment(target, fragment) {
  if (!target || typeof target !== 'object' || Array.isArray(target) || !fragment || typeof fragment !== 'object' || Array.isArray(fragment)) return target
  for (const [key, value] of Object.entries(fragment)) {
    const existing = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : null
    if (value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object' && !Array.isArray(existing)) {
      mergeStructuredRepairFragment(existing, value)
    } else {
      defineRepairKey(target, key, cloneJson(value))
    }
  }
  return target
}

function parseStructuredRepairObject(content) {
  const normalized = normalizeContentParts(content)
  if (typeof normalized !== 'string' || !normalized.trim()) return null
  let candidate = normalized.trim()
  if (candidate.startsWith('<think>')) {
    const end = candidate.lastIndexOf('</think>')
    if (end < 0) return null
    candidate = candidate.slice(end + '</think>'.length).trim()
  }
  if (candidate.startsWith('```') && candidate.endsWith('```')) {
    const firstNewline = candidate.indexOf('\n')
    if (firstNewline < 0) return null
    candidate = candidate.slice(firstNewline + 1, -3).trim()
  }
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function createStructuredRepairPlan(contract, failedContent, { maxPieces = 6, maxDepth = 2 } = {}) {
  if (!contract || contract.kind !== 'json_schema') return fail('repair requires json_schema contract')
  const schema = contract.schema
  if (!repairObjectSchema(schema)) return fail('repair currently supports decomposable object roots only')

  const draft = parseStructuredRepairObject(failedContent)
  const seed = {}
  const needed = []
  const reused = { count: 0 }
  const collected = collectRepairNeeds({ schema, draft, root: schema, maxDepth: Math.max(0, Math.min(4, Number.isInteger(maxDepth) ? maxDepth : 2)), seed, needed, reused })
  if (!collected.ok) return collected
  if (needed.length === 0) {
    const salvaged = validateValue(seed, schema)
    if (!salvaged.ok) return fail('repair found no regenerable required fields')
    return { ok: true, seed, reusedCount: reused.count, parts: [] }
  }

  const pieceLimit = Math.max(1, Math.min(8, Number.isInteger(maxPieces) ? maxPieces : 6))
  const pieceCount = Math.min(pieceLimit, needed.length)
  const groups = Array.from({ length: pieceCount }, () => [])
  needed.forEach((entry, index) => groups[index % pieceCount].push(entry))
  const parts = groups.filter((group) => group.length > 0).map((entries, index) => {
    const partSchema = buildRepairFragmentSchema(entries, schema)
    const partContract = buildStructuredOutputContract({
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: `${contract.name || 'result'}_repair_${index + 1}`,
          strict: contract.strict === true,
          schema: partSchema,
        },
      },
    })
    return {
      keys: [...new Set(entries.map((entry) => entry.path[0]))],
      paths: entries.map((entry) => [...entry.path]),
      contract: partContract,
    }
  })
  if (parts.some((part) => !part.contract.ok)) return fail('repair fragment contract build failed')
  return { ok: true, seed, reusedCount: reused.count, parts }
}

export function extractSingleCompletionStructuredObject(payload) {
  if (!Array.isArray(payload?.choices) || payload.choices.length !== 1) return null
  return parseStructuredRepairObject(payload.choices[0]?.message?.content)
}
