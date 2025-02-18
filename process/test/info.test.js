import { test, before } from 'node:test'
import * as assert from 'node:assert'
import AoLoader from '@permaweb/ao-loader'
import fs from 'fs'

const wasm = fs.readFileSync('./process.wasm')
const options = { format: "wasm64-unknown-emscripten-draft_2024_02_15" }

// REFERENCE: https://github.com/ar-io/ar-io-mainnet-csvs # TODO - set this as a hash
const EXPECTED_RECORD_COUNT = 2882
const EXPECTED_VAULT_COUNT = 1446
const EXPECTED_GATEWAY_COUNT = 277
const EXPECTED_PRIMARY_NAME_COUNT = 575
const EXPECTED_BALANCE_COUNT = 9161
const EXPECTED_TOTAL_SUPPLY = 10 ** 15; // 1B ARIO
const EXPECTED_PROTOCOL_BALANCE = 65 * (10 ** 12); // 65M ARIO
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
  assert.ok(gateways.totalItems === EXPECTED_GATEWAY_COUNT, `Total gateways is not ${EXPECTED_GATEWAY_COUNT}: ${gateways.totalItems}`)
})

test('return preloaded records', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Records' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const records = JSON.parse(result.Messages[0]?.Data)
  assert.ok(records.totalItems === EXPECTED_RECORD_COUNT, `Total records is not ${EXPECTED_RECORD_COUNT}: ${records.totalItems}`)
})

test('return preloaded vaults', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Vaults' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const vaults = JSON.parse(result.Messages[0]?.Data)
  assert.ok(vaults.totalItems === EXPECTED_VAULT_COUNT, `Total vaults is not ${EXPECTED_VAULT_COUNT}: ${vaults.totalItems}`)
})

test('return preloaded primary names', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Primary-Names' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const primaryNames = JSON.parse(result.Messages[0]?.Data)
  assert.ok(primaryNames.totalItems === EXPECTED_PRIMARY_NAME_COUNT, `Total primary names is not ${EXPECTED_PRIMARY_NAME_COUNT}: ${primaryNames.totalItems}`)
})

test('return preloaded balances', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Balances' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const balances = JSON.parse(result.Messages[0]?.Data)
  assert.ok(Object.keys(balances).length === EXPECTED_BALANCE_COUNT, `Total balances is not ${EXPECTED_BALANCE_COUNT}: ${Object.keys(balances).length}`)
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
  assert.ok(vaults.totalItems === EXPECTED_VAULT_COUNT, `Total vaults is not ${EXPECTED_VAULT_COUNT}: ${vaults.totalItems}`)
})

test('total token supply', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Total-Token-Supply' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const supplyDetails = JSON.parse(result.Messages[0]?.Data)
  assert.ok(supplyDetails.total === EXPECTED_TOTAL_SUPPLY, `Total supply is not 1B: ${supplyDetails.totalSupply} (difference: ${(EXPECTED_TOTAL_SUPPLY - supplyDetails.totalSupply) / 10 ** 6} IO)`)
  assert.ok(supplyDetails.protocolBalance === EXPECTED_PROTOCOL_BALANCE, `Protocol balance is not 65M IO: ${supplyDetails.protocolBalance}`)
})

test('return total supply of 1B', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Total-Supply' }
    ],
  })
  const totalSupply = JSON.parse(result.Messages[0]?.Data)
  const expected = 10 ** 15
  assert.ok(totalSupply === expected, `Total supply is not 1B: ${totalSupply} (difference: ${(expected - totalSupply)} IO)`)
})
