import { test, before } from 'node:test'
import * as assert from 'node:assert'
import AoLoader from '@permaweb/ao-loader'
import fs from 'fs'

const wasm = fs.readFileSync('./process.wasm')
const options = { format: "wasm64-unknown-emscripten-draft_2024_02_15" }

const env = {
  Process: {
    Id: 'AOS',
    Owner: 'FOOBAR',
    Tags: [
      { name: 'Name', value: 'ARIO' },
      { name: 'Authority', value: 'FOOBAR' }
    ]
  }
}
const handle = await AoLoader(wasm, options)
const send = (memory, msg) => handle(memory, {
    Target: 'AOS',
    From: 'FOOBAR',
    Owner: 'FOOBAR',
    'Block-Height': '999',
    Id: 'AOS',
    Timestamp: '1000',
    Module: 'WOOPAWOOPA',
    ...msg
}, env)
let start

before(async () => {
  // initialize initialize the wasm
  const init = await send(null, {
    Tags: [
      { name: 'Name', value: 'ARIO' }
    ]
  })
  // create the process
  const msg = {
    Tags: [
      { name: 'Type', value: 'Process'}
    ],
  }
  const createProcess = await send(init.Memory, msg)
  start = createProcess.Memory
})

test('perform a simple eval', async () => {
 const msg = {
    Tags: [
      { name: 'Action', value: 'Eval' }
    ],
    Data: 'print("hello world")'
  }
  const result = await send(start, msg)
  assert.ok(result.Output.data === 'hello world')
})

test('return preloaded gateways', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Gateways' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
})

test('return preloaded records', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Records' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
})

test('return preloaded vaults', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Vaults' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
})

test('return preloaded primary names', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Primary-Names' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
})

test('return preloaded balances', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Balances' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
})

test.skip('return total supply of 1B', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Total-Supply' }
    ],
  })
  assert.ok(result.Messages[0]?.Data === 10 ** 15)
})
