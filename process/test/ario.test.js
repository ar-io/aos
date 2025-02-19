import { test, before } from 'node:test'
import * as assert from 'node:assert'
import AoLoader from '@permaweb/ao-loader'
import fs from 'fs'

const wasm = fs.readFileSync('./process.wasm')
const options = { format: "wasm64-unknown-emscripten-draft_2024_02_15" }

// REFERENCE: https://github.com/ar-io/ar-io-mainnet-csvs # TODO - set this as a hash
const EXPECTED_RECORD_COUNT = 2884
const EXPECTED_VAULT_COUNT = 1446
const EXPECTED_GATEWAY_COUNT = 277
const EXPECTED_PRIMARY_NAME_COUNT = 575
const EXPECTED_BALANCE_COUNT = 9162 // TODO: confirm why 9183 balances after 200 ticks
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
  // TODO: confirm this catches any failed module references or bad wasm errors
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
  const output = result.Output.data
  assert.ok(output.includes('"Message-Id": "'))
  assert.ok(output.includes('"From": "FOOBAR"'))
  assert.ok(output.includes('"Action": "Eval"'))
  assert.ok(output.includes('"Timestamp": 1740009600000'))
  assert.ok(output.includes('hello world'))
})

test('eval from non-owner address fails', async () => {
  const msg = {
    From: 'non-owner',
    Owner: 'non-owner',
    Tags: [
      { name: 'Action', value: 'Eval' }
    ],
    Data: 'print("hello world")'
  }
  const result = await send(start, msg)
  assert.ok(result.Messages.length === 0)
})

test('log an event on default handler getting called', async () => {
  const result = await send(start, {
    Tags: [
      { name: 'Action', value: 'Not-An-Action' }
    ],
  })
  const output = result.Output.data
  assert.ok(output.includes('"Message-Id": "'))
  assert.ok(output.includes('"From": "FOOBAR"'))
  assert.ok(output.includes('"Default-Handler": true'))
  assert.ok(output.includes('"Action": "Not-An-Action"'))
  assert.ok(output.includes('"Timestamp": 1740009600000'))
  assert.ok(result.Messages.length === 0)
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

test('return preloaded vaults', async () => {
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

test('return total token supply', async () => {
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

test('transfer to an eth address', async () => {
  const transferQty = 1000000
  const recipient = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c'
  const result = await send(start, {
    From: 'AOS',
    Owner: 'AOS',
    Tags: [
      { name: 'Action', value: 'Transfer' },
      { name: 'Recipient', value: recipient },
      { name: 'Quantity', value: transferQty }
    ],
  })

  // get the balances before and after
  const balancesBeforeResult = await send(start, {
    Tags: [
      { name: 'Action', value: 'Balance' },
      { name: 'Address', value: recipient }
    ],
  })

  const balancesAfterResult = await send(result.Memory, {
    Tags: [
      { name: 'Action', value: 'Balance' },
      { name: 'Address', value: recipient }
    ],
  })
  const balancesBefore = parseInt(balancesBeforeResult.Messages[0]?.Data)
  const balancesAfter = parseInt(balancesAfterResult.Messages[0]?.Data)
  assert.ok(balancesAfter === balancesBefore + transferQty, `Balance is not ${balancesBefore + transferQty}: ${balancesAfter}`)
})

test('transfer to an arweave address', async () => {
  const transferQty = 1000000
  const recipient = 'dQzhAKa0qKPtMR8NuJAL2yB_qsT0QfAuc2CwtiUyhts'
  const result = await send(start, {
    From: 'AOS',
    Owner: 'AOS',
    Tags: [
      { name: 'Action', value: 'Transfer' },
      { name: 'Recipient', value: recipient },
      { name: 'Quantity', value: transferQty }
    ],  
  })

  const balancesBeforeResult = await send(start, {
    Tags: [
      { name: 'Action', value: 'Balance' },
      { name: 'Address', value: recipient }
    ],
  })

  const balancesAfterResult = await send(result.Memory, {
    Tags: [
      { name: 'Action', value: 'Balance' },
      { name: 'Address', value: recipient }
    ],
  })

  const balancesBefore = parseInt(balancesBeforeResult.Messages[0]?.Data)
  const balancesAfter = parseInt(balancesAfterResult.Messages[0]?.Data)
  assert.ok(balancesAfter === balancesBefore + transferQty, `Balance is not ${balancesBefore + transferQty}: ${balancesAfter}`)
})

test('buy a name', async () => {
  const transferQty = 1000000000000
  const recipient = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c'
  const transferResult = await send(start, {
    From: 'AOS',
    Owner: 'AOS',
    Tags: [
      { name: 'Action', value: 'Transfer' },
      { name: 'Recipient', value: recipient },
      { name: 'Quantity', value: transferQty }
    ],
  })
    const processId = 'dQzhAKa0qKPtMR8NuJAL2yB_qsT0QfAuc2CwtiUyhts'
  const result = await send(transferResult.Memory, {
    From: recipient,
    Owner: recipient,
    Tags: [
      { name: 'Action', value: 'Buy-Name' },
      { name: 'Name', value: 'test-arns-name' },
      { name: 'Process-Id', value: processId }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const nameDetails = JSON.parse(result.Messages[0]?.Data)
  assert.ok(nameDetails.name === 'test-arns-name', `Name is not test-arns-name: ${nameDetails.name}`)
  assert.ok(nameDetails.type === 'lease', `Purchase type is not lease: ${nameDetails.type}`)
  assert.ok(nameDetails.processId === processId, `Process ID is not ${processId}: ${nameDetails.processId}`)
  assert.ok(nameDetails.purchasePrice, 'Purchase price is not set')
  assert.ok(nameDetails.undernameLimit, 'Under name limit is not set')
  assert.ok(nameDetails.endTimestamp, 'End timestamp is not set')
})

test('join the network', async () => {
  const operatorAddress = '0xFCAd0B19bB29D4674531d6f115237E16AfCE377c'
  const transferQty = 10000000000
  const transferResult = await send(start, {
    From: 'AOS',
    Owner: 'AOS',
    Tags: [
      { name: 'Action', value: 'Transfer' },
      { name: 'Recipient', value: operatorAddress },
      { name: 'Quantity', value: transferQty }
    ],
  })
  const result = await send(transferResult.Memory, {
    From: operatorAddress,
    Owner: operatorAddress,
    Tags: [
      { name: 'Action', value: 'Join-Network' },
      { name: 'Observer-Address', value: operatorAddress },
      { name: 'Label', value: 'test-gateway' },
      { name: 'Note', value: 'test-note' },
      { name: 'FQDN', value: 'test-fqdn' },
      { name: 'Operator-Stake', value: `${transferQty}` },
      { name: 'Port', value: '443' },
      { name: 'Protocol', value: 'https' },
      { name: 'Allow-Delegated-Staking', value: 'true' },
      { name: 'Min-Delegated-Stake', value: `100000000` },
      { name: 'Delegate-Reward-Share-Ratio', value: '25' }, // 25% go to the delegates
      { name: 'Properties', value: 'FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44' },
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const joinNetworkDetails = JSON.parse(result.Messages[0]?.Data)
  assert.ok(joinNetworkDetails.status === 'joined', 'Gateway is not joined')  
  assert.ok(joinNetworkDetails.observerAddress === operatorAddress, 'Observer address is not set')
  assert.ok(joinNetworkDetails.operatorStake === transferQty, 'Operator stake is not set')
  assert.ok(joinNetworkDetails.settings.autoStake, 'Gateway is not auto-staking')
  assert.ok(joinNetworkDetails.settings.minDelegatedStake === 100000000, 'Min delegated stake is not 100 IO')
  assert.ok(joinNetworkDetails.settings.protocol === 'https', 'Protocol is not https')
  assert.ok(joinNetworkDetails.settings.port === 443, 'Port is not 443')
  assert.ok(joinNetworkDetails.settings.fqdn === 'test-fqdn', 'FQDN is not test-fqdn')
  assert.ok(joinNetworkDetails.settings.label === 'test-gateway', 'Label is not test-gateway')
  assert.ok(joinNetworkDetails.settings.note === 'test-note', 'Note is not test-note')
  assert.ok(joinNetworkDetails.settings.properties === 'FH1aVetOoulPGqgYukj0VE0wIhDy90WiQoV3U2PeY44', 'Properties are not set')
  assert.ok(joinNetworkDetails.settings.allowDelegatedStaking, 'Allow delegated staking is not true')
  assert.ok(joinNetworkDetails.settings.delegateRewardShareRatio === 25, 'Delegate reward share ratio is not 25')
  assert.ok(joinNetworkDetails.startTimestamp, 'Start timestamp is not set')
  assert.ok(joinNetworkDetails.totalDelegatedStake === 0, 'Total delegated stake is not 0')
  assert.ok(joinNetworkDetails.delegates.length === 0, 'Delegates are not empty')
  assert.ok(joinNetworkDetails.weights.compositeWeight === 0, 'Composite weight is not 0')
  assert.ok(joinNetworkDetails.weights.stakeWeight === 0, 'Stake weight is not 0')
  assert.ok(joinNetworkDetails.weights.tenureWeight === 0, 'Tenure weight is not 0')
  assert.ok(joinNetworkDetails.weights.observerPerformanceRatio === 0, 'Observer performance ratio is not 0')
  assert.ok(joinNetworkDetails.weights.gatewayPerformanceRatio === 0, 'Gateway performance ratio is not 0')
  assert.ok(joinNetworkDetails.weights.normalizedCompositeWeight === 0, 'Normalized composite weight is not 0')
  assert.ok(joinNetworkDetails.weights.observerPerformanceRatio === 0, 'Observer performance ratio is not 0')
  assert.ok(joinNetworkDetails.weights.gatewayPerformanceRatio === 0, 'Gateway performance ratio is not 0')
  assert.ok(joinNetworkDetails.weights.normalizedCompositeWeight === 0, 'Normalized composite weight is not 0')
})

// TODO: confirm demand factor starts at 2

// create a vault
test('create a vault', async () => {
  const recipient = 'dQzhAKa0qKPtMR8NuJAL2yB_qsT0QfAuc2CwtiUyhts'
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000
  const transferQty = 1000000000000
  const transferResult = await send(start, {
    From: 'AOS',
    Owner: 'AOS',
    Tags: [
      { name: 'Action', value: 'Transfer' },
      { name: 'Recipient', value: recipient },
      { name: 'Quantity', value: transferQty }
    ],
  })
  const createVaultResult = await send(transferResult.Memory, {
    From: recipient,
    Owner: recipient,
    Tags: [
      { name: 'Action', value: 'Create-Vault' },
      { name: 'Lock-Length', value: `${twoWeeksMs}` },
      { name: 'Quantity', value: transferQty }
    ],
  })
  assert.ok(createVaultResult.Messages[0]?.Data)
  const vaultDetails = JSON.parse(createVaultResult.Messages[0]?.Data)
  assert.ok(vaultDetails.startTimestamp, 'Start timestamp is not set')
  assert.ok(vaultDetails.balance === transferQty, 'Vault balance is not set')
  assert.ok(vaultDetails.endTimestamp === vaultDetails.startTimestamp + twoWeeksMs, 'Vault end timestamp is not set')
})
test('tick should create the genesis epoch', async () => {
  const result = await send(start, {
    Timestamp: '1741176000000', // 2025-03-04T12:00:00 UTC (7AM EST)
    'Hash-Chain': 'somearbitraryhashchain',
    Tags: [
      { name: 'Action', value: 'Tick' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)
  const demandFactorUpdatedNotice = result.Messages.find(msg => msg.Tags.find(tag => tag.name === 'Action' && tag.value === 'Demand-Factor-Updated-Notice'))
  assert.ok(demandFactorUpdatedNotice, 'Demand factor updated notice not sent for genesis epoch')
  const epochCreatedNotice = result.Messages.find(msg => msg.Tags.find(tag => tag.name === 'Action' && tag.value === 'Epoch-Created-Notice'))
  assert.ok(epochCreatedNotice, 'Epoch created notice not sent for genesis epoch')
  const epochCreatedNoticeData = JSON.parse(epochCreatedNotice.Data)
  assert.ok(epochCreatedNoticeData.epochIndex === 0, `Epoch index is not 0: ${epochCreatedNoticeData.epochIndex}`)
  assert.ok(epochCreatedNoticeData.startTimestamp === 1741176000000, `Epoch start timestamp is not 1741176000000: ${epochCreatedNoticeData.startTimestamp}`)
  assert.ok(epochCreatedNoticeData.endTimestamp === epochCreatedNoticeData.startTimestamp + (24 * 60 * 60 * 1000), `Epoch end timestamp is not correct: ${epochCreatedNoticeData.endTimestamp}`)
  assert.ok(Object.keys(epochCreatedNoticeData.prescribedObservers).length === 50, `Prescribed observers are not 50: ${Object.keys(epochCreatedNoticeData.prescribedObservers).length}`)
  assert.ok(epochCreatedNoticeData.prescribedNames.length === 2, `Prescribed names are not 2: ${epochCreatedNoticeData.prescribedNames.length}`)
})


test('tick to the 200th epoch and assert supply and supply is 1B', async () => {
  const startTimestamp = 1741176000000
  const epochPeriod = 24 * 60 * 60 * 1000
  const futureEpochTimestamp = startTimestamp + (200 * epochPeriod)
  const result = await send(start, {
    Timestamp: futureEpochTimestamp,
    'Hash-Chain': 'somearbitraryhashchain',
    Tags: [
      { name: 'Action', value: 'Tick' }
    ],
  })
  assert.ok(result.Messages[0]?.Data)

  // get the total supply again
  const totalSupplyResult = await send(start, {
    Tags: [
      { name: 'Action', value: 'Total-Supply' }
    ],
  })
  const totalSupply = JSON.parse(totalSupplyResult.Messages[0]?.Data)
  assert.ok(totalSupply === 10 ** 15, 'Total supply is not 1B')
})
