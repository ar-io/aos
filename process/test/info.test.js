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
    Timestamp: '1740009600000', // 2025-02-20 00:00:00
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
  // assert there is no error log in create process
  assert.ok(!createProcess.Output.data.includes('error'))
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
  const gateways = JSON.parse(result.Messages[0]?.Data)
  assert.ok(gateways.totalItems === 277, `Total gateways is not 277: ${gateways.totalItems}`)
})

test('return preloaded records', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Records' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const records = JSON.parse(result.Messages[0]?.Data)
  assert.ok(records.totalItems === 2882, `Total records is not 1446: ${records.totalItems}`)
})

test('return preloaded vaults', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Vaults' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const vaults = JSON.parse(result.Messages[0]?.Data)
  assert.ok(vaults.totalItems === 1446, `Total vaults is not 1446: ${vaults.totalItems}`)
})

test('return preloaded primary names', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Primary-Names' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const primaryNames = JSON.parse(result.Messages[0]?.Data)
  assert.ok(primaryNames.totalItems === 575, `Total primary names is not 1446: ${primaryNames.totalItems}`)
})

test('return preloaded balances', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Balances' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const balances = JSON.parse(result.Messages[0]?.Data)
  assert.ok(Object.keys(balances).length === 9161, `Total balances is not 9161: ${Object.keys(balances).length}`)
})

test('vaults', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Vaults' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  assert.ok(true)
  const vaults = JSON.parse(result.Messages[0]?.Data)
  assert.ok(vaults.totalItems === 1446, `Total vaults is not 1446: ${vaults.totalItems}`)
})

test('total token supply', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Total-Token-Supply' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const supplyDetails = JSON.parse(result.Messages[0]?.Data)
  assert.ok(supplyDetails.total === 10 ** 15, `Total supply is not 1B: ${supplyDetails.totalSupply} (difference: ${(10 ** 15 - supplyDetails.totalSupply) / 10 ** 6} IO)`)
  assert.ok(supplyDetails.protocolBalance === 65 * (10 ** 12), `Protocol balance is not 65M IO: ${supplyDetails.protocolBalance}`)
})

test('return total supply of 1B', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Total-Supply' }
    ],
  })
  console.log(result)
  const totalSupply = JSON.parse(result.Messages[0]?.Data)
  const expected = 10 ** 15
  console.log(totalSupply, expected)
  assert.ok(totalSupply === expected, `Total supply is not 1B: ${totalSupply} (difference: ${(expected - totalSupply)} IO)`)
})
